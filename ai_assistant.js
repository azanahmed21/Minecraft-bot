
const OpenAI = require("openai");
const { db } = require("./db");
const { chatLogs } = require("./db/schema");

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function getAIResponse(username, prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // Updated to latest gpt-5 model
      messages: [
        { role: "system", content: "You are a friendly Minecraft AFK bot. Keep your responses concise and helpful for in-game chat." },
        { role: "user", content: prompt }
      ],
    });
    
    const aiContent = response.choices[0].message.content;

    // Log to database
    try {
      await db.insert(chatLogs).values({
        username: username,
        message: prompt,
        response: aiContent,
      });
    } catch (dbError) {
      console.error("Error logging to database:", dbError);
    }

    return aiContent;
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "I'm sorry, I'm having trouble connecting right now.";
  }
}

module.exports = { getAIResponse };
