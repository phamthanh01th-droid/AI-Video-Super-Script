import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { AiResponse, FormValue } from './models';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private currentApiKeyIndex = 0;

  private getApiKey(apiKeys: string[]): string {
    if (apiKeys.length === 0) {
      throw new Error('No API keys provided.');
    }
    const apiKey = apiKeys[this.currentApiKeyIndex % apiKeys.length];
    this.currentApiKeyIndex++;
    return apiKey;
  }

  async generateStory(
    formValue: FormValue,
    writingStyleDesc: string,
    apiKeys: string[]
  ): Promise<AiResponse> {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('Please provide at least one Google Gemini API key.');
    }

    const successfulKeys = [];
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = this.getApiKey(apiKeys);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = this.constructPrompt(formValue, writingStyleDesc);
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                },
            });
    
            const jsonText = response.text.trim();
            if (!jsonText) {
                throw new Error('Received an empty response from the AI.');
            }
            
            const parsedResponse: AiResponse = JSON.parse(jsonText);
            return parsedResponse;

        } catch (error) {
            console.error(`Attempt with key ending in ...${apiKey.slice(-4)} failed:`, error);
            if (i === apiKeys.length - 1) { // Last key failed
                if (error instanceof Error) {
                    if (error.message.includes('API key not valid')) {
                        throw new Error( 'All provided Google Gemini API keys are invalid or have issues. Please check your keys and try again.');
                    }
                     if (error.message.includes('found block type')) {
                        throw new Error('The AI returned an invalid response format. This can happen with high safety settings. Please try again with a different theme.');
                    }
                    throw new Error(`Failed to generate story after trying all keys: ${error.message}`);
                }
                throw new Error('An unknown error occurred after trying all available API keys.');
            }
        }
    }
    throw new Error('All API keys failed. Please check your keys and try again.');
  }

  private constructPrompt(formValue: FormValue, writingStyleDesc: string): string {
    return `
**YOU ARE AN AI DIRECTOR, SCRIPTWRITER & SOCIAL MEDIA EXPERT.**

**CONTEXT:** A user needs a complete production package from a theme, specifically for the VEO 3 model.

**INPUT THEME:** "${formValue.theme}"

**STYLE OPTIONS:**
* Total Duration: "${formValue.duration} seconds"
* Visual Style: "${formValue.visualStyle}"
* Image Style: "${formValue.imageStyle}"
* Writing Style: "${formValue.writingStyle}" (${writingStyleDesc})
* Subtitle Language: "${formValue.language}"
* Aspect Ratio: "${formValue.aspectRatio}"

**CORE STYLE BIBLE:**
You MUST treat the following styles as the absolute source of truth. Every single prompt and description you generate must strictly adhere to this bible.
- **Master Visual Style:** ${formValue.visualStyle}
- **Master Image Style:** ${formValue.imageStyle}

**ABSOLUTE RULES:**
1.  **CHARACTER CONSISTENCY:** First, create a "character_sheet" array. For each character, create an object with a unique "character_id" (e.g., "CHAR_01") and a very detailed, consistent "description" (physical appearance, clothing, key accessories). You MUST reference these exact "character_id"s and their detailed descriptions in all subsequent prompts to ensure the character does not change.
// FIX: Replaced backticks with markdown bold to prevent template literal parsing errors.
2.  **VISUAL & STYLE CONSISTENCY:** For every **key_image_prompt** and every clip's subject/scene description, you MUST explicitly incorporate the "CORE STYLE BIBLE" to maintain a unified look. The prompt for scene 2 must visually and logically follow the end of scene 1, and so on, creating a coherent visual narrative.
3.  **SUBTITLES OFF:** The "subtitles" property within the "dialogue" object of every single clip MUST ALWAYS be **false**. This is a critical requirement for the VEO 3 pipeline.
4.  **SAFETY:** No graphic violence, gore, hate speech, or explicit sexual themes. Use metaphorical language for conflict.
5.  **PACING & CONTENT DENSITY:** The total spoken content should be dense and meaningful. For each scene, roughly 50% of the duration should be narration, and 30% should be character dialogue. Clips without spoken words are for visual storytelling. Narration should be broken into natural, short sentences.

**REQUIREMENTS:**
Your output MUST be a single, valid JSON object with THREE top-level keys: "character_sheet", "script", and "promotion".

**1. "character_sheet":** An array of character objects as per the rules.

**2. "script":** An array of scene objects, appropriately sized for the requested duration. For each scene, provide:
    *   **scene_number:** (Number)
    *   **scene_title:** (String)
    *   **key_image_prompt:** (String) A rich prompt for a text-to-image AI, strictly adhering to the "CORE STYLE BIBLE" and character descriptions.
    *   **characters_in_scene:** (Array of Strings) List of character_ids.
    *   **location_details:** (String)
    *   **lighting_tone:** (String)
    *   **color_palette:** (String)
    *   **clip_sequence:** (Array of Clip Objects) Each clip MUST follow the detailed JSON structure provided below.

**3. "promotion":** An object with marketing assets.
    *   **thumbnail_prompt:** (String)
    *   **social_media_posts:** (Object) with keys "youtube", "facebook", "tiktok", each with "title", "description", "hashtags" in the requested language.

**CLIP JSON STRUCTURE EXAMPLE (Follow this for EVERY clip):**
{
    "shot": { "composition": "Medium shot, 50mm lens", "camera_motion": "Slow pan left", "frame_rate": "24fps", "film_grain": "Light grain" },
    "subject": { "description": "[Detailed character action, referencing character_sheet]", "wardrobe": "[Clothing consistent with character_sheet]" },
    "scene": { "location": "[Location details]", "time_of_day": "Golden hour", "environment": "[Weather, background elements]" },
    "visual_details": { "action": "[Specific action and sound effects in brackets like [sound]]", "props": "[Relevant props]" },
    "cinematography": { "lighting": "[Lighting style]", "tone": "[Overall mood]", "notes": "[Special instructions]" },
    "audio": { "ambient": "[Background sounds]", "voice": { "tone": "Calm", "style": "Narrative" }, "music": "[Music style]" },
    "color_palette": "[Dominant colors]",
    "dialogue": { "character": "CHAR_01", "line": "This is it.", "subtitles": false },
    "narration_clip": "The final moment had arrived."
}

**OUTPUT FORMAT:**
**RETURN ONLY A SINGLE, VALID JSON OBJECT** matching this structure. Do not wrap it in markdown.
    `;
  }
}
