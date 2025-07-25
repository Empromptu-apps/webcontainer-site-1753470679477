import React, { useState, useRef } from 'react';

const OKRDashboard = () => {
  const [initiatives, setInitiatives] = useState([]);
  const [selectedInitiative, setSelectedInitiative] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showApiLogs, setShowApiLogs] = useState(false);
  const [createdObjects, setCreatedObjects] = useState([]);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);

  const API_BASE = 'https://builder.empromptu.ai/api_tools';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 22c3d153c7f536d80c3c384fb6ddc93c',
    'X-Generated-App-ID': '8a784b41-a834-47d9-bdd6-1e372d62650f',
    'X-Usage-Key': '369397c6ffb66469db3dc7796c8f70f9'
  };

  const logApiCall = (endpoint, payload, response) => {
    const log = {
      timestamp: new Date().toISOString(),
      endpoint,
      payload,
      response,
      id: Date.now()
    };
    setApiLogs(prev => [log, ...prev]);
  };

  // Helper function to safely parse API response data
  const parseApiResponse = (responseData) => {
    try {
      // If responseData.value is already an array of objects, return it directly
      if (Array.isArray(responseData.value)) {
        return responseData.value;
      }

      // If it's a string that looks like JSON, try to parse it
      if (typeof responseData.value === 'string') {
        // Clean up common formatting issues
        let cleanedData = responseData.value
          .replace(/```json|```/g, '')
          .trim();
        
        try {
          return JSON.parse(cleanedData);
        } catch (jsonError) {
          console.warn('JSON parse failed, trying alternative parsing:', jsonError);
          
          // Try to extract JSON-like structure using regex
          const jsonMatch = cleanedData.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          
          throw new Error('Could not parse response as JSON');
        }
      }

      // If it's already an object/array, return as is
      return responseData.value;
      
    } catch (error) {
      console.error('Error parsing API response:', error);
      console.log('Raw response data:', responseData);
      throw new Error('Failed to parse initiative data from API response');
    }
  };

  // Helper function to normalize initiative data structure
  const normalizeInitiativeData = (rawData) => {
    if (!Array.isArray(rawData)) {
      console.error('Expected array but got:', typeof rawData, rawData);
      return [];
    }

    return rawData.map((item, index) => {
      // Handle different possible key formats
      const getId = (obj) => {
        return obj.id || obj['Initiative ID/Name'] || obj.name || `initiative-${index}`;
      };

      const getName = (obj) => {
        return obj.name || obj['Initiative ID/Name'] || obj.id || `Initiative ${index + 1}`;
      };

      const getOwner = (obj) => {
        return obj.owner || obj.Owner || 'Unassigned';
      };

      const getStatus = (obj) => {
        return obj.status || obj.Status || 'Not Started';
      };

      const getProgress = (obj) => {
        const progress = obj.progress || obj['Progress percentage'] || obj.Progress || '0';
        return String(progress).replace('%', '');
      };

      const getDueDate = (obj) => {
        return obj.dueDate || obj['Due date'] || obj.DueDate || 'TBD';
      };

      const getDescription = (obj) => {
        return obj.description || obj.Description || 'No description provided';
      };

      const getRelatedOKR = (obj) => {
        return obj.relatedOKR || obj['Related OKR/Goal'] || obj.RelatedOKR || 'No related OKR';
      };

      return {
        id: getId(item),
        name: getName(item),
        owner: getOwner(item),
        status: getStatus(item),
        progress: getProgress(item),
        dueDate: getDueDate(item),
        description: getDescription(item),
        relatedOKR: getRelatedOKR(item)
      };
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.add('border-primary-500', 'bg-primary-50');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current && !dragRef.current.contains(e.relatedTarget)) {
      dragRef.current.classList.remove('border-primary-500', 'bg-primary-50');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-primary-500', 'bg-primary-50');
    }
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setCurrentStep(2);
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      // Step 1: Upload CSV data to the API
      const inputPayload = {
        created_object_name: 'okr_data',
        data_type: 'strings',
        input_data: [fileContent]
      };

      const inputResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(inputPayload)
      });

      const inputResult = await inputResponse.json();
      logApiCall('/input_data', inputPayload, inputResult);
      setCreatedObjects(prev => [...prev.filter(obj => obj !== 'okr_data'), 'okr_data']);

      setUploadProgress(30);

      // Step 2: Process the CSV data into structured format
      const processPayload = {
        created_object_names: ['processed_initiatives'],
        prompt_string: `Parse this CSV data and convert it to a JSON array. Each row should be an object with these exact keys: "id", "name", "owner", "status", "progress", "dueDate", "description", "relatedOKR". 

The CSV has headers: Initiative ID/Name,Owner,Status,Progress percentage,Due date,Description,Related OKR/Goal

For each row:
- Use "Initiative ID/Name" column for both "id" and "name" fields
- Use "Owner" column for "owner" field  
- Use "Status" column for "status" field
- Use "Progress percentage" column for "progress" field (remove % symbol if present)
- Use "Due date" column for "dueDate" field
- Use "Description" column for "description" field
- Use "Related OKR/Goal" column for "relatedOKR" field

Return ONLY a valid JSON array with no additional text or formatting. CSV data: {okr_data}`,
        inputs: [{
          input_object_name: 'okr_data',
          mode: 'combine_events'
        }]
      };

      const processResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(processPayload)
      });

      const processResult = await processResponse.json();
      logApiCall('/apply_prompt', processPayload, processResult);
      setCreatedObjects(prev => [...prev.filter(obj => obj !== 'processed_initiatives'), 'processed_initiatives']);

      setUploadProgress(70);

      // Step 3: Retrieve the processed data
      const returnPayload = {
        object_name: 'processed_initiatives',
        return_type: 'json'
      };

      const returnResponse = await fetch(`${API_BASE}/return_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(returnPayload)
      });

      const returnResult = await returnResponse.json();
      logApiCall('/return_data', returnPayload, returnResult);

      setUploadProgress(90);

      // Parse and normalize the response data
      let parsedData;
      try {
        parsedData = parseApiResponse(returnResult);
        console.log('Parsed API response:', parsedData);
      } catch (parseError) {
        console.error('Failed to parse API response:', parseError);
        alert('Error parsing the processed data. Please check the CSV format and try again.');
        setCurrentStep(1);
        setIsProcessing(false);
        return;
      }

      // Normalize the initiative data
      const normalizedInitiatives = normalizeInitiativeData(parsedData);
      console.log('Normalized initiatives:', normalizedInitiatives);

      if (normalizedInitiatives.length === 0) {
        alert('No valid initiatives found in the CSV file. Please check the format.');
        setCurrentStep(1);
        setIsProcessing(false);
        return;
      }

      setUploadProgress(100);

      // Update existing initiatives and add new ones
      setInitiatives(prevInitiatives => {
        const updatedInitiatives = [...prevInitiatives];
        
        normalizedInitiatives.forEach(newInit => {
          const existingIndex = updatedInitiatives.findIndex(init => init.id === newInit.id);
          if (existingIndex >= 0) {
            updatedInitiatives[existingIndex] = newInit;
            console.log(`Updated existing initiative: ${newInit.id}`);
          } else {
            updatedInitiatives.push(newInit);
            console.log(`Added new initiative: ${newInit.id}`);
          }
        });
        
        return updatedInitiatives;
      });

      setTimeout(() => {
        setCurrentStep(3);
        setIsProcessing(false);
      }, 500);

    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error.message}. Please check the CSV format and try again.`);
      setCurrentStep(1);
      setIsProcessing(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cancelProcessing = () => {
    setCurrentStep(1);
    setIsProcessing(false);
    setUploadProgress(0);
  };

  const downloadCSV = () => {
    const headers = ['Initiative ID/Name', 'Owner', 'Status', 'Progress percentage', 'Due date', 'Description', 'Related OKR/Goal'];
    const csvContent = [
      headers.join(','),
      ...initiatives.map(init => [
        `"${init.name || init.id}"`,
        `"${init.owner}"`,
        `"${init.status}"`,
        `"${init.progress}%"`,
        `"${init.dueDate}"`,
        `"${init.description.replace(/"/g, '""')}"`,
        `"${init.relatedOKR.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okr_initiatives_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const deleteAllObjects = async () => {
    if (!window.confirm('Are you sure you want to delete all API objects?')) return;

    for (const objectName of createdObjects) {
      try {
        const response = await fetch(`${API_BASE}/objects/${objectName}`, {
          method: 'DELETE',
          headers
        });
        const result = await response.text();
        logApiCall(`DELETE /objects/${objectName}`, {}, result);
      } catch (error) {
        console.error(`Error deleting ${objectName}:`, error);
      }
    }
    setCreatedObjects([]);
    alert('All API objects deleted');
  };

  const getStatusColor = (status) => {
    const colors = {
      'Completed': darkMode ? 'bg-green-900 text-green-100 border-green-700' : 'bg-green-100 text-green-800 border-green-200',
      'In Progress': darkMode ? 'bg-blue-900 text-blue-100 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200',
      'At Risk': darkMode ? 'bg-red-900 text-red-100 border-red-700' : 'bg-red-100 text-red-800 border-red-200',
      'On Hold': darkMode ? 'bg-yellow-900 text-yellow-100 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Not Started': darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || (darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200');
  };

  const sortedInitiatives = [...initiatives].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || a.id).localeCompare(b.name || b.id);
      case 'owner': return a.owner.localeCompare(b.owner);
      case 'status': return a.status.localeCompare(b.status);
      case 'progress': return parseInt(b.progress) - parseInt(a.progress);
      case 'dueDate': return new Date(a.dueDate) - new Date(b.dueDate);
      default: return 0;
    }
  });

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              OKR Initiative Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowApiLogs(!showApiLogs)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-medium transition-colors"
                aria-label="Toggle API logs"
              >
                API Logs ({apiLogs.length})
              </button>
              {createdObjects.length > 0 && (
                <button
                  onClick={deleteAllObjects}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-medium transition-colors"
                  aria-label="Delete all API objects"
                >
                  Delete Objects ({createdObjects.length})
                </button>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-2xl transition-colors ${
                  darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-700'
                }`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* API Logs */}
          {showApiLogs && (
            <div className={`mb-6 rounded-2xl shadow-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>API Call Logs</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {apiLogs.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No API calls yet</div>
                ) : (
                  apiLogs.map(log => (
                    <div key={log.id} className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-mono text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {log.endpoint}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className={`cursor-pointer text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          View Details
                        </summary>
                        <pre className={`mt-2 p-2 rounded text-xs overflow-x-auto ${
                          darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          <strong>Request:</strong>
                          {JSON.stringify(log.payload, null, 2)}
                          
                          <strong>Response:</strong>
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div className={`rounded-2xl shadow-lg p-8 mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-center">
                <h2 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Upload Initiative Data
                </h2>
                <div
                  ref={dragRef}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 transition-colors ${
                    darkMode 
                      ? 'border-gray-600 bg-gray-700 hover:border-primary-400 hover:bg-gray-600' 
                      : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'
                  }`}
                >
                  <div className="text-6xl mb-4">📄</div>
                  <p className={`text-lg mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Drag and drop your CSV file here
                  </p>
                  <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Expected format: Initiative ID/Name, Owner, Status, Progress percentage, Due date, Description, Related OKR/Goal
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                    aria-label="Upload CSV file"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-2xl cursor-pointer transition-colors"
                  >
                    Choose File
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Processing */}
          {currentStep === 2 && (
            <div className={`rounded-2xl shadow-lg p-8 mb-6 text-center ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="spinner mx-auto mb-6"></div>
              <h2 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Processing Your Data
              </h2>
              <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Extracting and structuring initiative data...
              </p>
              <div className={`w-full bg-gray-200 rounded-full h-2 mb-6 ${darkMode ? 'bg-gray-700' : ''}`}>
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <button
                onClick={cancelProcessing}
                className={`px-4 py-2 rounded-2xl font-medium transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                aria-label="Cancel processing"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Step 3: Data Output */}
          {currentStep === 3 && initiatives.length > 0 && (
            <div className={`rounded-2xl shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <div>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Initiative Data
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''} loaded
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`border rounded-2xl px-3 py-2 text-sm ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      aria-label="Sort initiatives by"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="owner">Sort by Owner</option>
                      <option value="status">Sort by Status</option>
                      <option value="progress">Sort by Progress</option>
                      <option value="dueDate">Sort by Due Date</option>
                    </select>
                    <button
                      onClick={downloadCSV}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-medium transition-colors"
                      aria-label="Download CSV"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-medium transition-colors"
                      aria-label="Upload new file"
                    >
                      Upload New File
                    </button>
                  </div>
                </div>
              </div>

              {/* Bootstrap Table */}
              <div className="overflow-x-auto">
                <table className={`table table-hover ${darkMode ? 'table-dark' : ''}`}>
                  <thead>
                    <tr>
                      <th scope="col">Initiative</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Status</th>
                      <th scope="col">Progress</th>
                      <th scope="col">Due Date</th>
                      <th scope="col">Related OKR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInitiatives.map((initiative) => (
                      <tr
                        key={initiative.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedInitiative(
                          selectedInitiative?.id === initiative.id ? null : initiative
                        )}
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${initiative.name || initiative.id}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedInitiative(
                              selectedInitiative?.id === initiative.id ? null : initiative
                            );
                          }
                        }}
                      >
                        <td className="fw-medium">{initiative.name || initiative.id}</td>
                        <td>{initiative.owner}</td>
                        <td>
                          <span className={`badge ${getStatusColor(initiative.status)}`}>
                            {initiative.status}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="progress me-2" style={{ width: '60px', height: '8px' }}>
                              <div
                                className="progress-bar bg-primary"
                                style={{ width: `${Math.min(100, Math.max(0, parseInt(initiative.progress) || 0))}%` }}
                              ></div>
                            </div>
                            <small>{initiative.progress}%</small>
                          </div>
                        </td>
                        <td>{initiative.dueDate}</td>
                        <td className="text-truncate" style={{ maxWidth: '200px' }}>
                          {initiative.relatedOKR}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail View */}
          {selectedInitiative && (
            <div className={`rounded-2xl shadow-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Initiative Details
                  </h2>
                  <button
                    onClick={() => setSelectedInitiative(null)}
                    className={`p-2 rounded-2xl transition-colors ${
                      darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    aria-label="Close details"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Initiative ID/Name
                      </label>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedInitiative.name || selectedInitiative.id}
                      </p>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Owner
                      </label>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedInitiative.owner}
                      </p>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Status
                      </label>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedInitiative.status)}`}>
                        {selectedInitiative.status}
                      </span>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Progress
                      </label>
                      <div className="flex items-center space-x-3">
                        <div className={`flex-1 rounded-full h-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div
                            className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, parseInt(selectedInitiative.progress) || 0))}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {selectedInitiative.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Due Date
                      </label>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedInitiative.dueDate}
                      </p>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Related OKR/Goal
                      </label>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedInitiative.relatedOKR}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <div className={`rounded-2xl p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`whitespace-pre-wrap ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInitiative.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {currentStep === 3 && initiatives.length === 0 && (
            <div className="text-center py-12">
              <div className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                No initiatives found in the uploaded file
              </div>
              <div className={`text-sm mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Please check your CSV format and try again
              </div>
              <button
                onClick={() => setCurrentStep(1)}
                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-medium transition-colors"
              >
                Upload Another File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OKRDashboard;
