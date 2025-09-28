import * as nsfwjs from 'nsfwjs';

// Cache the model so we don't reload it every time
let model = null;

const loadModel = async () => {
  if (!model) {
    model = await nsfwjs.load();
  }
  return model;
};

export const validateProfilePicture = async (file) => {
  // Basic validations first
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  if (!file.type.startsWith('image/')) {
    return { isValid: false, error: 'Please select an image file' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { isValid: false, error: 'Image must be smaller than 5MB' };
  }

  try {
    // Load NSFW model
    const nsfwModel = await loadModel();
    
    // Create image element for analysis
    const imageElement = document.createElement('img');
    const imageUrl = URL.createObjectURL(file);
    
    return new Promise((resolve) => {
      imageElement.onload = async () => {
        try {
          // Analyze image
          const predictions = await nsfwModel.classify(imageElement);
          
          // Clean up
          URL.revokeObjectURL(imageUrl);
          
          // Check if inappropriate (you can adjust these thresholds)
          const inappropriate = predictions.some(prediction => 
            (prediction.className === 'Porn' && prediction.probability > 0.3) ||
            (prediction.className === 'Sexy' && prediction.probability > 0.6) ||
            (prediction.className === 'Drawing' && prediction.probability > 0.3) ||
            (prediction.className === 'Hentai' && prediction.probability > 0.3)
          );

          if (inappropriate) {
            resolve({ isValid: false, error: 'Please choose a different image' });
          } else {
            resolve({ isValid: true });
          }
        } catch (error) {
          console.error('NSFW analysis failed:', error);
          // If NSFW check fails, allow the image (failsafe approach)
          resolve({ isValid: true });
        }
      };

      imageElement.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        resolve({ isValid: false, error: 'Invalid image file' });
      };

      imageElement.src = imageUrl;
    });

  } catch (error) {
    console.error('Profile picture validation failed:', error);
    // If validation fails entirely, allow the image (failsafe)
    return { isValid: true };
  }
};