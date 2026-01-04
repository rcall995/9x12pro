// AI Pitch Generator using Claude Haiku
// Generates personalized outreach messages based on business data

import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Anthropic API key not configured',
      message: 'Please add ANTHROPIC_API_KEY to Vercel environment variables'
    });
  }

  const {
    business,      // { name, category, rating, review_count, price, city, zip, website, facebook, instagram, contactName }
    platform,      // 'email' | 'instagram_dm' | 'facebook_dm' | 'text'
    urgency,       // 'low' | 'medium' | 'high' | 'printing_friday'
    userContext,   // Optional: "just opened 2nd location", "saw their truck", etc.
    sender,        // { name, company, phone, spotPrice }
    homeCount,     // Number of homes the postcard reaches (e.g., 5000)
    deliveryZip    // The ZIP code where the postcard will be delivered (may differ from business location)
  } = req.body;

  if (!business?.name || !platform || !sender?.name) {
    return res.status(400).json({ error: 'Missing required fields: business.name, platform, sender.name' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Build context about the business
    const businessContext = buildBusinessContext(business);
    const platformGuidelines = getPlatformGuidelines(platform);
    const urgencyContext = getUrgencyContext(urgency);

    const systemPrompt = `You are a friendly, conversational sales copywriter helping a postcard advertising company reach out to local businesses.

Your task: Write a personalized outreach message for the specified platform.

Guidelines:
- Be conversational and human, not salesy or corporate
- Keep it SHORT - these are cold outreach messages
- Use the business details naturally (don't force them all in)
- Never use generic phrases like "I hope this finds you well"
- Don't use emojis in emails, use 1-2 max in DMs/texts
- Focus on ONE value prop: they'd be the only [category] on the card
- If you have a contact name, use their first name
- Match the tone to the platform (casual for DM, slightly more professional for email)
- Include a clear but soft call to action
- Do NOT invent details not provided
- Never mention the rating/reviews directly (feels stalker-ish)
- ALWAYS use "we" instead of "I" (company voice, not individual)
- Reference the postcard as an ESTABLISHED thing, not something new you're starting`;

    // Use deliveryZip if provided, otherwise fall back to business zip
    const targetZip = deliveryZip || business.zip || 'the area';

    const userPrompt = `Write a ${platform.replace('_', ' ')} outreach message.

BUSINESS INFO:
${businessContext}

POSTCARD INFO:
- Postcard Name: "The ${targetZip} Spotlight" (this is an ESTABLISHED postcard, not a new project)
- Delivery Area: ${targetZip} - goes to every home in the area
- Homes Reached: ${homeCount || '~5,000'} homes
- Price: ${sender.spotPrice || 'not specified'}

SENDER INFO:
- Company: ${sender.company || 'not specified'}
- Contact: ${sender.name}

PLATFORM: ${platform}
${platformGuidelines}

URGENCY: ${urgencyContext}

${userContext ? `IMPORTANT CONTEXT: ${userContext}` : ''}

CRITICAL RULES:
1. Use "we" instead of "I" throughout (company voice)
2. Reference "The ${targetZip} Spotlight" as an established postcard, NOT something you're "putting together" or "starting"
3. When mentioning location, use "${targetZip}" - this is where the postcards go

Write ONLY the message - no subject line, no signature block, no explanation. Just the message text ready to copy and paste.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const message = response.content[0].text.trim();

    // Generate subject line for email
    let subject = null;
    if (platform === 'email') {
      const subjectResponse = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: `Write a short, curiosity-inducing email subject line for a pitch to a ${business.category || 'local business'} about "The ${targetZip} Spotlight" postcard. Keep it under 8 words. No quotes. Examples: "${targetZip} Spotlight - ${business.category} spot?", "Quick question about the ${targetZip} Spotlight"`
          }
        ]
      });
      subject = subjectResponse.content[0].text.trim().replace(/^["']|["']$/g, '');
    }

    return res.status(200).json({
      message,
      subject,
      platform,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0
    });

  } catch (error) {
    console.error('AI pitch generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate pitch',
      message: error.message
    });
  }
}

function buildBusinessContext(business) {
  const lines = [];

  lines.push(`- Business Name: ${business.name}`);

  if (business.category) {
    lines.push(`- Category: ${business.category}`);
  }

  if (business.city && business.zip) {
    lines.push(`- Location: ${business.city}, ${business.zip}`);
  } else if (business.zip) {
    lines.push(`- ZIP Code: ${business.zip}`);
  }

  if (business.rating && business.review_count) {
    lines.push(`- Reputation: ${business.rating} stars with ${business.review_count} reviews (established business)`);
  } else if (business.review_count && business.review_count < 20) {
    lines.push(`- Reputation: Newer business (${business.review_count} reviews) - may benefit from exposure`);
  }

  if (business.price) {
    const priceDesc = {
      '$': 'budget-friendly',
      '$$': 'mid-range',
      '$$$': 'upscale',
      '$$$$': 'premium/luxury'
    };
    lines.push(`- Price Point: ${business.price} (${priceDesc[business.price] || 'unknown'})`);
  }

  if (business.contactName) {
    lines.push(`- Contact Name: ${business.contactName}`);
  }

  if (business.website) {
    lines.push(`- Has website: Yes`);
  }

  if (business.instagram) {
    lines.push(`- Has Instagram: Yes`);
  }

  if (business.facebook) {
    lines.push(`- Has Facebook: Yes`);
  }

  return lines.join('\n');
}

function getPlatformGuidelines(platform) {
  const guidelines = {
    email: `EMAIL GUIDELINES:
- Professional but warm tone
- 3-5 sentences max
- No emojis
- End with contact name and phone
- Use "we" not "I"`,

    instagram_dm: `INSTAGRAM DM GUIDELINES:
- Very casual, friendly tone
- 2-3 sentences max
- Can use 1-2 emojis if natural
- Quick question format works well
- Use "we" not "I"`,

    facebook_dm: `FACEBOOK MESSENGER GUIDELINES:
- Casual, conversational tone
- 2-4 sentences max
- 1 emoji max
- Feel free to be more personal
- Use "we" not "I"`,

    text: `TEXT/SMS GUIDELINES:
- Ultra short - like texting a friend
- 1-2 sentences max
- Skip the intro pleasantries
- Get straight to the point
- Use "we" not "I"`
  };

  return guidelines[platform] || guidelines.email;
}

function getUrgencyContext(urgency) {
  const contexts = {
    low: 'No rush - just initial outreach',
    medium: 'Filling spots for upcoming card',
    high: 'Only a few spots left',
    printing_friday: 'Card goes to print Friday - genuine deadline'
  };

  return contexts[urgency] || contexts.low;
}
