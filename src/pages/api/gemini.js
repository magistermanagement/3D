// src/pages/api/gemini.js

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Ensure you have installed the @google/generative-ai package:
  // npm install @google/generative-ai

  // Make sure GEMINI_API_KEY is set in your environment variables
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key not found in environment variables' });
  }

  const genAI = new GoogleGenerativeAI({ apiKey });

  if (req.method === 'POST') {
    try {
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Select the correct model from Gemini (assuming "gemini-pro" or similar is correct)
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      // Generate the content with the model
      const result = await model.generateContent(prompt);

      // Check if result is structured as expected
      if (result && result.response && result.response.text) {
        // Get the generated text
        const generatedText = result.response.text;

        return res.status(200).json({ response: generatedText });
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      return res.status(500).json({
        error: 'Failed to generate text',
        details: error.message
      });
    }
  } else {
    // Handling other HTTP methods (e.g., GET)
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
