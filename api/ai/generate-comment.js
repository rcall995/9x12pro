// AI Comment Generator for Spark Engagement System
// Generates contextual comments for business posts to build rapport and plant seeds for co-op postcard partnership

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
    businessName,    // Name of the business
    postContent,     // The business's post content
    platform,        // 'facebook' | 'instagram'
    groupName,       // Town or card theme (e.g., "Kenmore" or "What's For Dinner in Kenmore")
    sellLevel = 3,   // 1-5 scale: 1=just engage, 5=direct ask
    homeCount = 5000, // Number of homes the postcard reaches
    spotPrice = '$500', // Price per ad spot
    refinement,      // Optional: refinement instructions or follow-up context
    isFollowUp       // Optional: true if this is a follow-up response
  } = req.body;

  if (!businessName || !postContent || !groupName) {
    return res.status(400).json({
      error: 'Missing required fields: businessName, postContent, groupName'
    });
  }

  // Sell level instructions - Use "we" (company voice) and reference postcard by exact name user provides
  const sellLevelGuide = {
    1: `SELL LEVEL 1 - JUST ENGAGE: Write a genuine, friendly comment about their post. NO mention of postcards, mailers, or what you do. Just be a supportive local person.`,
    2: `SELL LEVEL 2 - LIGHT HINT: Write a genuine comment. You may subtly hint that you "work with local businesses" but do NOT mention postcards or mailers specifically. Use "we" not "I".`,
    3: `SELL LEVEL 3 - MENTION POSTCARD: Write a genuine comment that casually mentions "${groupName}" (an ESTABLISHED local postcard, not a new thing). Use "we" not "I". Keep it natural, not salesy.`,
    4: `SELL LEVEL 4 - SOFT INVITE: Write a genuine comment, then mention "${groupName}" (our established community postcard) and that we'd love to feature them. Use "we" not "I". Still friendly, not pushy.`,
    5: `SELL LEVEL 5 - DIRECT ASK: Write a genuine comment, then directly mention we're looking for a [their business type] for "${groupName}" and ask if they'd be interested. Use "we" not "I".`
  };

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const systemPrompt = isFollowUp
      ? `You are helping someone continue a friendly conversation with a local business owner on social media.

Your task: Write a natural follow-up reply that keeps the conversation going.

Guidelines:
- Be warm and friendly, like talking to a neighbor
- Keep it short (1-3 sentences max)
- Don't be salesy or pushy
- Reference what they said in their response
- Keep building rapport naturally
- If they asked a question, answer it helpfully
- Always use "we" instead of "I" (company voice)
- If appropriate, you can mention we work with local businesses on "${groupName}", but don't push
- 1-2 emojis max, only if it feels natural`

      : `You are helping someone engage with local small business posts on ${platform === 'instagram' ? 'Instagram' : 'Facebook'}.

CONTEXT: The commenter runs "${groupName}" - an ESTABLISHED community postcard that goes to ${homeCount.toLocaleString()} homes. This is NOT a new project - it's an existing, well-known local marketing piece. Local businesses share ad space on this postcard. Ad spots cost ${spotPrice}.

IMPORTANT:
- Always use "we" (company voice), never "I"
- Reference the postcard by its EXACT name "${groupName}" - do NOT add words like "Spotlight" or change the name
- When mentioning reach, say "${homeCount.toLocaleString()} homes" NOT "every home"

${sellLevelGuide[sellLevel] || sellLevelGuide[3]}

Guidelines:
- Lead with genuine engagement about their post
- Keep it short (2-3 sentences max)
- Sound like a real local person, not a marketer
- NEVER say "I noticed" or "I saw your post"
- Always use "we" instead of "I"
- Use the EXACT postcard name "${groupName}" - do not modify it
- Use "${homeCount.toLocaleString()} homes" for reach
${platform === 'instagram' ? `- Casual tone, 1-2 emojis welcome
- End with 1-2 LOCAL hashtags` : '- Friendly but slightly more professional tone, NO hashtags (they look spammy on Facebook comments)'}

Examples by sell level:
Level 1: "Those look incredible! 🔥 Love seeing local spots thrive."
Level 2: "This is awesome! We work with a few local businesses around here - always cool to see what others are up to."
Level 3: "Love this! We run ${groupName} - great to see local spots killing it."
Level 4: "These look amazing! We run ${groupName} - would love to feature you guys on an upcoming edition!"
Level 5: "Wow, these are great! We're looking for a [business type] for ${groupName} - it goes to ${homeCount.toLocaleString()} homes. Would you be interested in chatting about it?"`;

    // Sell level requirement text for user prompt
    const sellRequirement = {
      1: 'Write ONLY a genuine compliment/engagement. Do NOT mention postcards or what we do.',
      2: 'Write a genuine comment with a very light hint that we work with local businesses. Use "we" not "I".',
      3: `Write a genuine comment that MUST mention "${groupName}" as our established community postcard. Use "we" not "I".`,
      4: `Write a genuine comment that MUST mention "${groupName}" AND say we would love to feature them. Use "we" not "I".`,
      5: `Write a genuine comment that MUST directly ASK if they want to be on "${groupName}". Mention it goes to ${homeCount.toLocaleString()} homes. Use "we" not "I". This is a direct pitch - be friendly but clear.`
    };

    const userPrompt = isFollowUp
      ? `${postContent}

Write a friendly follow-up reply. ${refinement || ''}`

      : `Business: ${businessName}
Platform: ${platform === 'instagram' ? 'Instagram' : 'Facebook'}
Town/Theme: ${groupName}
SELL LEVEL: ${sellLevel} out of 5

Their post:
"${postContent}"

${refinement ? `Additional instructions: ${refinement}` : ''}

IMPORTANT: ${sellRequirement[sellLevel] || sellRequirement[3]}

Just output the comment text, nothing else.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const comment = response.content[0].text.trim();

    return res.status(200).json({
      comment,
      platform,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0
    });

  } catch (error) {
    console.error('AI comment generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate comment',
      message: error.message
    });
  }
}
