// components/StudentSoftware.jsx
import React from 'react';

const StudentSoftware = () => {
  const softwareOptions = [
    {
      name: 'SnapGene',
      description: 'Professional molecular biology software for DNA sequence analysis and cloning.',
      downloadUrl: 'https://www.snapgene.com/download/',
      logo: '🧬',
      features: ['Sequence editing', 'Chromatogram viewing', 'Primer design', 'Cloning simulation'],
      platform: 'Windows, Mac, Linux'
    },
    {
      name: '4Peaks',
      description: 'Free DNA sequence trace viewer for Mac with chromatogram analysis capabilities.',
      downloadUrl: 'https://nucleobytes.com/4peaks/',
      logo: '⛰️',
      features: ['Chromatogram viewing', 'Quality analysis', 'Sequence editing', 'Export options'],
      platform: 'Mac only'
    },
    {
      name: 'FinchTV',
      description: 'Free chromatogram viewer for analyzing DNA sequencing traces and quality.',
      downloadUrl: 'https://digitalworldbiology.com/FinchTV',
      logo: '🦅',
      features: ['Trace viewing', 'Base calling', 'Quality scores', 'Multi-format support'],
      platform: 'Windows, Mac'
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">DNA Analysis Software</h3>
        <p className="text-sm text-gray-600 mt-1">Download and install software for analyzing DNA sequence files</p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {softwareOptions.map(software => (
            <div key={software.name} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <span className="text-3xl mr-3">{software.logo}</span>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{software.name}</h4>
                  <p className="text-sm text-gray-500">{software.platform}</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{software.description}</p>
              
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Key Features:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {software.features.map(feature => (
                    <li key={feature} className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              <a
                href={software.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-200 text-center block font-medium"
              >
                Download {software.name}
              </a>
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">Software Installation Tips:</p>
            <ul className="space-y-1">
              <li>• <strong>SnapGene:</strong> Professional software with free viewer version available</li>
              <li>• <strong>4Peaks:</strong> Free for Mac users, excellent for chromatogram analysis</li>
              <li>• <strong>FinchTV:</strong> Free cross-platform option, great for beginners</li>
              <li>• Contact your instructor if you need help installing or using any software</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-2">System Requirements:</p>
            <p>Make sure your computer meets the system requirements before downloading. 
            If you encounter any issues, please message your instructor for assistance.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSoftware;