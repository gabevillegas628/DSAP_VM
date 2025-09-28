// Updated apiService.js with authentication re-enabled

import config from '../config'; // adjust path as needed
const API_BASE = config.API_BASE;

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };

    // Always get fresh token from localStorage instead of cached this.token
    const currentToken = localStorage.getItem('token');
    //console.log('API call - Using token:', currentToken ? 'Token exists' : 'No token found');

    // FIXED: Re-enable authentication
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    return headers;
  }

  async downloadExport(exportOptions) {
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE}/export-v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify(exportOptions)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Export failed: ${response.status} - ${errorText}`);
    }

    return response.blob();
  }

  async downloadBlob(endpoint) {
    const headers = {
      'ngrok-skip-browser-warning': 'true'
    };

    // FIXED: Use fresh token from localStorage
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers
    });

    if (response.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.blob();
  }

  async handleResponse(response) {
    

    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (response.status === 403) {
      throw new Error('Access denied - insufficient permissions');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response Body:`, errorText);
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('Expected JSON but got:', contentType);
      console.error('Response body:', responseText.substring(0, 500));
      throw new Error(`Server returned ${contentType} instead of JSON. Check server logs.`);
    }

    try {
      const jsonData = await response.json();
      //console.log(`API Success Response:`, jsonData);
      return jsonData;
    } catch (parseError) {
      const responseText = await response.text();
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', responseText.substring(0, 500));
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
  }

  // GET request
  async get(endpoint) {
    const fullUrl = `${API_BASE}${endpoint}`;
    //console.log(`API GET: ${fullUrl}`);
    //console.log('Request headers:', this.getHeaders());

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: this.getHeaders()
    });

    

    return this.handleResponse(response);
  }

  // POST request
  async post(endpoint, data) {
    //console.log(`API POST: ${API_BASE}${endpoint}`, data);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // PUT request
  async put(endpoint, data) {
    //console.log(`API PUT: ${API_BASE}${endpoint}`, data);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // PATCH request
  async patch(endpoint, data) {
    //console.log(`API PATCH: ${API_BASE}${endpoint}`, data);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // DELETE request
  async delete(endpoint) {
    //console.log(`API DELETE: ${API_BASE}${endpoint}`);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // Special method for file uploads
  async uploadFiles(endpoint, formData) {
    //console.log(`API UPLOAD: ${API_BASE}${endpoint}`);
    const headers = {
      'ngrok-skip-browser-warning': 'true'
    };

    // FIXED: Use fresh token from localStorage
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    // Don't set Content-Type for FormData - browser will set it with boundary

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData
    });
    return this.handleResponse(response);
  }
}

// Create a singleton instance
const apiService = new ApiService();
export default apiService;

// Export specific methods for backward compatibility
export const { get, post, put, patch, delete: del, uploadFiles, setToken } = apiService;