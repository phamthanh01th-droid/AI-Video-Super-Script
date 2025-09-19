import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { JsonPipe } from '@angular/common';

import { GeminiService } from './gemini.service';
import { AiResponse, GenerationState, Scene, Clip } from './models';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, JsonPipe],
  templateUrl: './app.component.html',
  styles: [`
    /* Custom styles for the duration slider thumb */
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      background: #22d3ee; /* cyan-400 */
      cursor: pointer;
      border-radius: 50%;
      margin-top: -7px; /* Adjust vertical position */
    }

    input[type=range]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: #22d3ee; /* cyan-400 */
      cursor: pointer;
      border-radius: 50%;
      border: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  JSON = JSON; // Expose JSON to the template
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  private readonly COOLDOWN_TIME_S = 60;

  // UI Options
  visualStyles = ['Cinematic', 'Anime', 'Documentary', 'Vlog', 'Sci-Fi', 'Fantasy', 'Horror', 'Noir', 'Cyberpunk', 'Steampunk', 'Vintage', 'Minimalist', 'Surreal', 'Abstract', 'Nature', 'Urban', 'Historical', 'Gothic', 'Pop Art', 'Comic Book'];
  imageStyles = ['Photorealistic', '3D Render', 'Hand-drawn', 'Pixel Art', 'Oil Painting', 'Watercolor', 'Vector Art', 'Low Poly', 'Impressionistic', 'Expressionistic', 'Concept Art', 'Blueprint', 'Chalk Art', 'Charcoal Sketch', 'Claymation', 'Stop Motion', 'Glitch Art', 'Holographic', 'Infrared', 'X-Ray'];
  writingStyles = new Map([
    ['Storytelling', 'Classic narrative arc with a beginning, middle, and end.'],
    ['Hook-Story-Offer', 'Grab attention, tell a compelling story, and present a call to action.'],
    ['Problem-Agitate-Solve', 'Identify a problem, explore its impact, and offer the solution.'],
    ['Educational', 'Informative and instructional, breaking down complex topics.'],
    ['Inspirational', 'Motivational and uplifting, designed to evoke positive emotions.'],
    ['Comedy', 'Humorous and lighthearted, using wit and jokes.'],
    ['Dramatic', 'Serious and emotional, focusing on conflict and resolution.'],
    ['Poetic', 'Lyrical and artistic, using figurative language.'],
    ['Investigative', 'Journalistic and fact-based, uncovering details.'],
    ['Absurdist', 'Bizarre and nonsensical, challenging logic.']
  ]);
  languages = new Map([
    ['Vietnamese', 'vi'],
    ['English', 'en'],
    ['Chinese', 'zh'],
    ['Japanese', 'ja']
  ]);
  aspectRatios = ['16:9', '9:16'];
  
  // API Key Management
  apiKeys = signal<string[]>([]);
  apiKeyForm = this.fb.group({
    newKey: ['', [Validators.required, Validators.minLength(10)]]
  });

  // Form Definition
  form = this.fb.group({
    theme: ['A lone astronaut discovers a sentient plant on a desolate moon.', [Validators.required, Validators.minLength(10)]],
    visualStyle: [this.visualStyles[0], Validators.required],
    imageStyle: [this.imageStyles[0], Validators.required],
    duration: [90, Validators.required], // 1 min 30 seconds
    writingStyle: [Array.from(this.writingStyles.keys())[0], Validators.required],
    language: [Array.from(this.languages.keys())[0], Validators.required],
    aspectRatio: [this.aspectRatios[0], Validators.required],
  });

  // State Management Signals
  generationState = signal<GenerationState>('idle');
  aiResponse = signal<AiResponse | null>(null);
  errorMessage = signal<string>('');
  cooldownSeconds = signal(this.COOLDOWN_TIME_S);

  // UI State Signals
  activeSceneTab = signal(1);
  activePromotionTab = signal<'youtube' | 'facebook' | 'tiktok'>('youtube');
  jsonModal = signal<{ visible: boolean; content: string; title: string }>({ visible: false, content: '', title: '' });

  // Computed Signals
  isLoading = computed(() => this.generationState() === 'loading');
  onCooldown = computed(() => this.generationState() === 'cooldown');
  canSubmit = computed(() => this.form.valid && this.apiKeys().length > 0 && !this.isLoading() && !this.onCooldown());
  writingStyleKeys = computed(() => Array.from(this.writingStyles.keys()));
  languageKeys = computed(() => Array.from(this.languages.keys()));

  constructor() {
    // Load API keys from sessionStorage on init
    if (typeof sessionStorage !== 'undefined') {
      const storedKeys = sessionStorage.getItem('apiKeys');
      if (storedKeys) {
        this.apiKeys.set(JSON.parse(storedKeys));
      }
    }

    // Persist API keys to sessionStorage on change
    effect(() => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('apiKeys', JSON.stringify(this.apiKeys()));
      }
    });
  }

  addApiKey() {
    if (this.apiKeyForm.invalid) return;
    const newKey = this.apiKeyForm.value.newKey!;
    this.apiKeys.update(keys => [...keys, newKey]);
    this.apiKeyForm.reset();
  }

  removeApiKey(indexToRemove: number) {
    this.apiKeys.update(keys => keys.filter((_, index) => index !== indexToRemove));
  }

  private startCooldown() {
    this.generationState.set('cooldown');
    this.cooldownSeconds.set(this.COOLDOWN_TIME_S);
    const interval = setInterval(() => {
      this.cooldownSeconds.update(s => s - 1);
      if (this.cooldownSeconds() <= 0) {
        clearInterval(interval);
        if (this.aiResponse()) {
            this.generationState.set('success');
        } else {
            this.generationState.set('idle');
        }
      }
    }, 1000);
  }

  async onSubmit() {
    if (this.apiKeys().length === 0) {
        this.generationState.set('error');
        this.errorMessage.set('Please add a Google Gemini API key before generating a script.');
        return;
    }
    if (!this.canSubmit()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.generationState.set('loading');
    this.aiResponse.set(null);
    this.errorMessage.set('');

    try {
      const formValue = this.form.getRawValue();
      const writingStyleDesc = this.writingStyles.get(formValue.writingStyle!) || '';
      const result = await this.geminiService.generateStory(formValue, writingStyleDesc, this.apiKeys());
      this.aiResponse.set(result);
      this.generationState.set('success');
    } catch (e) {
      this.generationState.set('error');
      this.errorMessage.set(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      this.startCooldown();
    }
  }

  // UI Interaction Methods
  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy text: ', err));
  }

  showJsonModal(clip: Clip, sceneNum: number, clipIdx: number) {
    const title = `Scene ${sceneNum} - Clip ${clipIdx + 1} JSON`;
    const content = JSON.stringify(clip, null, 2);
    this.jsonModal.set({ visible: true, content, title });
  }

  closeJsonModal() {
    this.jsonModal.set({ visible: false, content: '', title: '' });
  }

  // SRT Generation
  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  }

  downloadSrt() {
    const response = this.aiResponse();
    if (!response) return;

    let srtContent = '';
    let currentTime = 0;
    let subtitleIndex = 1;
    const CLIP_DURATION = 8; // As per user's description

    response.script.forEach(scene => {
        scene.clip_sequence.forEach(clip => {
            const hasNarration = clip.narration_clip && clip.narration_clip.trim().length > 0;
            const hasDialogue = clip.dialogue && clip.dialogue.line && clip.dialogue.line.trim().length > 0;
            
            if (hasNarration || hasDialogue) {
                const startTime = currentTime;
                // Allocate time based on content
                const narrationTime = hasNarration ? CLIP_DURATION * 0.5 : 0;
                const dialogueTime = hasDialogue ? CLIP_DURATION * 0.3 : 0;
                const endTime = startTime + Math.max(narrationTime, dialogueTime);

                srtContent += `${subtitleIndex++}\n`;
                srtContent += `${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n`;
                if(hasNarration) srtContent += `${clip.narration_clip}\n`;
                if(hasDialogue) srtContent += `${clip.dialogue.character}: ${clip.dialogue.line}\n`;
                srtContent += '\n';
            }
            currentTime += CLIP_DURATION;
        });
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  }
}
