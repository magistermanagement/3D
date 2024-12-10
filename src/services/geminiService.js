// services/geminiService.ts
import axios from 'axios';

const BASE_URL = 'http://localhost:5173/api/gemini';  // Check this URL

class GeminiService {
  static async getResponse(text) {
    try {
      const response = await axios.post(`${BASE_URL}/response`, { text });
      return response.data;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  static async transcribeAudio(base64Audio: string) {
    try {
      const response = await axios.post(`${BASE_URL}/transcribe`, { audio: base64Audio });
      return response.data;
    } catch (error) {
      console.error('Audio Transcription Error:', error);
      throw error;
    }
  }
}

export default GeminiService;