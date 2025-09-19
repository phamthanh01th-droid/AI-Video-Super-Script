export interface AiResponse {
  character_sheet: Character[];
  script: Scene[];
  promotion: Promotion;
}

export interface Character {
  character_id: string;
  description: string;
}

export interface Scene {
  scene_number: number;
  scene_title: string;
  key_image_prompt: string;
  characters_in_scene: string[];
  location_details: string;
  lighting_tone: string;
  color_palette: string;
  clip_sequence: Clip[];
}

export interface Clip {
  shot: {
    composition: string;
    camera_motion: string;
    frame_rate: string;
    film_grain: string;
  };
  subject: {
    description: string;
    wardrobe: string;
  };
  scene: {
    location: string;
    time_of_day: string;
    environment: string;
  };
  visual_details: {
    action: string;
    props: string;
  };
  cinematography: {
    lighting: string;
    tone: string;
    notes: string;
  };
  audio: {
    ambient: string;
    voice: {
      tone: string;
      style: string;
    };
    music: string;
  };
  color_palette: string;
  dialogue: {
    character: string;
    line: string;
    subtitles: boolean;
  };
  narration_clip: string;
}

export interface Promotion {
  thumbnail_prompt: string;
  social_media_posts: {
    youtube: SocialPost;
    facebook: SocialPost;
    tiktok: SocialPost;
  };
}

export interface SocialPost {
  title: string;
  description: string;
  hashtags: string;
}

export type GenerationState = 'idle' | 'loading' | 'success' | 'error' | 'cooldown';

export interface FormValue {
    theme: string;
    visualStyle: string;
    imageStyle: string;
    duration: number;
    writingStyle: string;
    language: string;
    aspectRatio: string;
}
