// components/DirectorSchools.jsx - Updated to use apiService
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import apiService from '../services/apiService';

const DirectorSchools = () => {
  const [schools, setSchools] = useState([]);
  const [instructors, setInstructors] = useState([]); // Dynamic list from database
  const [loading, setLoading] = useState(true);
  const [schoolSortConfig, setSchoolSortConfig] = useState({ key: null, direction: 'asc' });
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: '', schoolId: '', instructor: '' });
  const [editingSchool, setEditingSchool] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [students, setStudents] = useState([]);

  // Fetch schools and instructors from API
  useEffect(() => {
    fetchSchools();
    fetchInstructors();
    fetchStudents();
  }, []);

  const fetchSchools = async () => {
    try {
      const data = await apiService.get('/schools');
      setSchools(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching schools:', error);
      setLoading(false);
    }
  };

  // Fetch instructors from database
  const fetchInstructors = async () => {
    try {
      const data = await apiService.get('/users?role=instructor&status=approved');
      setInstructors(data);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  // Fetch students from database
  const fetchStudents = async () => {
    try {
      const data = await apiService.get('/users?role=student&status=approved');
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  // Calculate actual student count for a school
  const getStudentCountForSchool = (schoolId) => {
    return students.filter(student => student.schoolId === schoolId).length;
  };

  const sortSchoolTable = (key) => {
    let direction = 'asc';
    if (schoolSortConfig.key === key && schoolSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSchoolSortConfig({ key, direction });
  };

  const getSortedSchools = () => {
    if (!schoolSortConfig.key) return schools;

    return [...schools].sort((a, b) => {
      let aVal = a[schoolSortConfig.key];
      let bVal = b[schoolSortConfig.key];

      // Handle student count sorting
      if (schoolSortConfig.key === 'students') {
        aVal = getStudentCountForSchool(a.id);
        bVal = getStudentCountForSchool(b.id);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (schoolSortConfig.direction === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  };

  const updateSchoolInstructor = async (schoolId, instructorId) => {  // Now receives ID
    try {
      // Find the instructor name for display (since backend still stores name in school table)
      const instructor = instructors.find(inst => inst.id === parseInt(instructorId));
      const instructorName = instructor ? instructor.name : 'Unassigned';

      const updatedSchool = await apiService.put(`/schools/${schoolId}`, {
        instructor: instructorName,  // Still send name for school table
        instructorId: instructorId   // Add ID for user table update
      });

      // Update local state
      setSchools(prev => prev.map(school =>
        school.id === schoolId ? { ...school, instructor: instructorName } : school
      ));

      // Refresh instructors list to show updated school assignments
      fetchInstructors();
    } catch (error) {
      console.error('Error updating instructor:', error);
    }
  };

  const addNewSchool = async () => {
  if (newSchool.name && newSchool.schoolId) {
    try {
      // Find instructor name from ID
      const instructor = instructors.find(inst => inst.id === parseInt(newSchool.instructor));
      const instructorName = instructor ? instructor.name : 'Unassigned';
      
      const newSchoolData = await apiService.post('/schools', {
        name: newSchool.name,
        schoolId: newSchool.schoolId.padStart(3, '0'),
        instructor: instructorName,  // Send name for display
        instructorId: newSchool.instructor  // Send ID for user assignment
      });

      setSchools(prev => [...prev, newSchoolData]);
      setNewSchool({ name: '', schoolId: '', instructor: '' });
      setShowSchoolForm(false);
      
      // Refresh instructors to show updated assignments
      fetchInstructors();
    } catch (error) {
      console.error('Error adding school:', error);
      alert(error.message || 'Failed to add school');
    }
  }
};

  // Update the editSchool function to properly map name back to ID:
const editSchool = (school) => {
  // Find the instructor ID from the current instructor name
  const instructor = instructors.find(inst => inst.name === school.instructor);
  const instructorId = instructor ? instructor.id.toString() : '';
  
  setEditingSchool({ 
    ...school, 
    instructor: instructorId  // Store as ID for the dropdown
  });
  setShowEditForm(true);
};

  const updateSchool = async () => {
    if (editingSchool && editingSchool.name && editingSchool.schoolId) {
      try {
        // Find the instructor name from the ID
        const instructor = instructors.find(inst => inst.id === parseInt(editingSchool.instructor));
        const instructorName = instructor ? instructor.name : 'Unassigned';

        const updatedSchool = await apiService.put(`/schools/${editingSchool.id}`, {
          name: editingSchool.name,
          schoolId: editingSchool.schoolId.padStart(3, '0'),
          instructor: instructorName,  // Send name for display
          instructorId: editingSchool.instructor  // Send ID for user table update
        });

        setSchools(prev => prev.map(school =>
          school.id === editingSchool.id ? updatedSchool : school
        ));
        setShowEditForm(false);
        setEditingSchool(null);

        // Refresh instructors to show updated assignments
        fetchInstructors();
      } catch (error) {
        console.error('Error updating school:', error);
        alert(error.message || 'Failed to update school');
      }
    }
  };

  const removeSchool = (schoolId) => {
    const schoolToRemove = schools.find(school => school.id === schoolId);
    setSchoolToDelete(schoolToRemove);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSchool = async () => {
    if (schoolToDelete) {
      try {
        await apiService.delete(`/schools/${schoolToDelete.id}`);
        setSchools(prev => prev.filter(school => school.id !== schoolToDelete.id));
        setShowDeleteConfirm(false);
        setSchoolToDelete(null);
      } catch (error) {
        console.error('Error deleting school:', error);
        alert('Failed to delete school');
      }
    }
  };

  const cancelDeleteSchool = () => {
    setShowDeleteConfirm(false);
    setSchoolToDelete(null);
  };

  // Render instructor select dropdown
  const renderInstructorSelect = (currentValue, onChange, showUnassigned = true) => (
    <select
      value={currentValue || ''}
      onChange={onChange}
      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
    >
      {showUnassigned && <option value="">Unassigned</option>}
      {instructors.map(instructor => (
        <option key={instructor.id} value={instructor.id}>  {/* ✅ Use ID instead of name */}
          {instructor.name} ({instructor.email})
        </option>
      ))}
    </select>
  );

  // Show helpful message when no instructors exist
  const renderInstructorGuidance = () => {
    if (instructors.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>No instructors available.</strong> Create instructor accounts in the User Management tab first,
                then return here to assign them to schools.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const sortedSchools = getSortedSchools();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 text-center">
          <p className="text-gray-600">Loading schools...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">School Management</h3>
            <p className="text-sm text-gray-600 mt-1">Manage participating schools and instructors</p>
          </div>
          <button
            onClick={() => setShowSchoolForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            + Add School
          </button>
        </div>

        <div className="p-6">
          {renderInstructorGuidance()}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => sortSchoolTable('schoolId')}
                  >
                    School ID {schoolSortConfig.key === 'schoolId' && (schoolSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => sortSchoolTable('name')}
                  >
                    School Name {schoolSortConfig.key === 'name' && (schoolSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => sortSchoolTable('instructor')}
                  >
                    Instructor {schoolSortConfig.key === 'instructor' && (schoolSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                    onClick={() => sortSchoolTable('students')}
                  >
                    Students {schoolSortConfig.key === 'students' && (schoolSortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSchools.map(school => (
                  <tr key={school.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-lg font-bold text-blue-600">{school.schoolId}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{school.name}</td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${school.instructor === 'Unassigned'
                        ? 'text-gray-500 italic'
                        : 'text-gray-900'
                        }`}>
                        {school.instructor}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                        {getStudentCountForSchool(school.id)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editSchool(school)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeSchool(school.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {schools.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No schools added yet. Click "Add School" to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* Add School Form Modal */}
      {showSchoolForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New School</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                <input
                  type="text"
                  value={newSchool.name}
                  onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter school name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School ID (3 digits)</label>
                <input
                  type="text"
                  value={newSchool.schoolId}
                  onChange={(e) => setNewSchool({ ...newSchool, schoolId: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="000-999"
                  maxLength="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructor {instructors.length === 0 && <span className="text-red-500">(None available - create instructors first)</span>}
                </label>
                {renderInstructorSelect(
                  newSchool.instructor,
                  (e) => setNewSchool({ ...newSchool, instructor: e.target.value }),
                  true
                )}
                {instructors.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Go to User Management → Add User → Role: Instructor to create instructor accounts first
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSchoolForm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={addNewSchool}
                disabled={!newSchool.name || !newSchool.schoolId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add School
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit School Form Modal */}
      {showEditForm && editingSchool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit School</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                <input
                  type="text"
                  value={editingSchool.name}
                  onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School ID (3 digits)</label>
                <input
                  type="text"
                  value={editingSchool.schoolId}
                  onChange={(e) => setEditingSchool({ ...editingSchool, schoolId: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructor</label>
                {renderInstructorSelect(
                  editingSchool.instructor === 'Unassigned' ? '' : editingSchool.instructor,
                  (e) => setEditingSchool({ ...editingSchool, instructor: e.target.value || 'Unassigned' }),
                  true
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingSchool(null);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={updateSchool}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
              >
                Update School
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && schoolToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to remove <strong>{schoolToDelete.name}</strong> (ID: {schoolToDelete.schoolId})?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">
                  <strong>Warning:</strong> This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={cancelDeleteSchool}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSchool}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200"
              >
                Delete School
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DirectorSchools;