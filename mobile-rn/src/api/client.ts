import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api';
import { Guide, GuidesListResponse, GuideSettings } from '../types/guide';
import { parseGuide } from '../utils/parseGuide';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_CONFIG.baseUrl}/api`,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          const friendly = new Error(
            'The server is taking longer than expected. Please check your connection and try again.'
          );
          console.error('API Timeout:', error.message);
          throw friendly;
        }
        if (!error.response) {
          const friendly = new Error(
            'Unable to reach the server. Please check your network connection.'
          );
          console.error('API Network Error:', error.message);
          throw friendly;
        }
        const serverMsg =
          (error.response.data as any)?.message || error.message;
        console.error('API Error:', serverMsg);
        throw new Error(serverMsg);
      }
    );
  }

  async uploadImage(
    imageUri: string,
    tags?: string[],
    settings?: Partial<GuideSettings>
  ): Promise<Guide> {
    const formData = new FormData();
    
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    if (tags) {
      formData.append('tags', JSON.stringify(tags));
    }
    if (settings) {
      formData.append('settings', JSON.stringify(settings));
    }

    const response = await this.client.post('/guides', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: API_CONFIG.uploadTimeout,
    });

    return parseGuide(response.data.data);
  }

  async getGuides(page: number = 1, pageSize: number = 20): Promise<GuidesListResponse> {
    const response = await this.client.get('/guides', {
      params: { page, pageSize },
    });
    const data = response.data.data;
    return {
      guides: Array.isArray(data.guides) ? data.guides.map(parseGuide) : [],
      total: Number(data.total) || 0,
      page: Number(data.page) || 1,
      pageSize: Number(data.pageSize) || 20,
    };
  }

  async getGuide(id: string): Promise<Guide> {
    const response = await this.client.get(`/guides/${id}`);
    return parseGuide(response.data.data);
  }

  async updateGuide(id: string, updates: { favorite?: boolean; tags?: string[]; name?: string }): Promise<Guide> {
    const response = await this.client.patch(`/guides/${id}`, updates);
    return parseGuide(response.data.data);
  }

  async ensureGuideMode(
    id: string,
    mode: 'silhouette'
  ): Promise<{ imageUrl: string; available: boolean; reason?: string }> {
    const response = await this.client.post(`/guides/${id}/mode/${mode}`);
    const data = response.data.data;
    return {
      imageUrl: String(data.imageUrl || ''),
      available: Boolean(data.available),
      reason: data.reason ? String(data.reason) : undefined,
    };
  }

  async cleanGuideBackground(id: string): Promise<Guide> {
    const response = await this.client.post(`/guides/${id}/clean-background`);
    return parseGuide(response.data.data);
  }

  async eraseGuideByStrokes(
    id: string,
    payload: {
      strokes: Array<Array<{ x: number; y: number }>>;
      brushSize: number;
    }
  ): Promise<{ guide: Guide; undoCount: number; redoCount: number }> {
    const response = await this.client.post(`/guides/${id}/erase`, payload);
    return {
      guide: parseGuide(response.data.data),
      undoCount: Number(response.data.undoCount) || 0,
      redoCount: Number(response.data.redoCount) || 0,
    };
  }

  async undoEraseGuide(id: string): Promise<{ guide: Guide; undoCount: number; redoCount: number }> {
    const response = await this.client.post(`/guides/${id}/erase-undo`);
    return {
      guide: parseGuide(response.data.data),
      undoCount: Number(response.data.undoCount) || 0,
      redoCount: Number(response.data.redoCount) || 0,
    };
  }

  async redoEraseGuide(id: string): Promise<{ guide: Guide; undoCount: number; redoCount: number }> {
    const response = await this.client.post(`/guides/${id}/erase-redo`);
    return {
      guide: parseGuide(response.data.data),
      undoCount: Number(response.data.undoCount) || 0,
      redoCount: Number(response.data.redoCount) || 0,
    };
  }

  async uploadGuideImage(id: string, localUri: string): Promise<Guide> {
    const filename = localUri.split('/').pop() || 'guide.png';
    const formData = new FormData();
    formData.append('guideImage', {
      uri: localUri,
      name: filename.endsWith('.png') ? filename : `${filename}.png`,
      type: 'image/png',
    } as any);

    const response = await this.client.post(`/guides/${id}/guide-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: API_CONFIG.uploadTimeout,
    });
    return parseGuide(response.data.data);
  }

  async deleteGuide(id: string): Promise<void> {
    await this.client.delete(`/guides/${id}`);
  }
}

export const apiClient = new ApiClient();
