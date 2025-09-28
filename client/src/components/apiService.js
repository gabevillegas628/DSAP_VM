// Create a new file: src/services/apiService.js

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
      'ngrok-skip-browser-warning': 'true'  // Add this line!
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
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
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // GET request
  async get(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // POST request
  async post(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // PUT request
  async put(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // DELETE request
  async delete(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // Special method for file uploads
  async uploadFiles(endpoint, formData) {
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
export const { get, post, put, delete: del, uploadFiles, setToken } = apiService;