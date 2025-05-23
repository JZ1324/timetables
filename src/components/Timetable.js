import React, { useState, useEffect, useRef } from 'react';
import TimeSlot from './TimeSlot';
import ImportButton from './ImportButton';
import ImportTimetable from './ImportTimetable';
import timetableService from '../services/timetableService';
import parseTimetable from '../utils/timetableParser';
import convertStructuredDataToTimeSlots from '../utils/convertStructuredDataToTimeSlots';
import { getCurrentSchoolDay, getCurrentPeriod, shouldShowBreakPeriod } from '../utils/dateUtils';
import { useAuth } from './AuthProvider';
import { isAdmin } from '../services/userService';
import AdminTerminal from './AdminTerminal';
import '../styles/components/Timetable.css';
import '../styles/components/TimeSlot.css';
import '../styles/components/CurrentDay.css';
import '../styles/components/BreakPeriods.css';

const Timetable = () => {
    const { user } = useAuth();
    const [timeSlots, setTimeSlots] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [currentTemplate, setCurrentTemplate] = useState('');
    const [currentDay, setCurrentDay] = useState(1);
    const [editMode, setEditMode] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [currentEditingSlot, setCurrentEditingSlot] = useState(null);
    const [currentPeriod, setCurrentPeriod] = useState('');
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [showAdminTerminal, setShowAdminTerminal] = useState(false);
    const [displaySettings, setDisplaySettings] = useState({
        displayCode: true,
        displayTeacher: true,
        displayRoom: true,
        useFirstNameForTeachers: false
    });
    const [visiblePeriods, setVisiblePeriods] = useState({
        Recess: false,
        Lunch: false
    });
    const [editingRowHeight, setEditingRowHeight] = useState(null);
    const editingRowRef = useRef(null);
    const labelRefs = useRef({});

    // Get all days from 1 to 10
    const days = Array.from({ length: 10 }, (_, i) => i + 1);
    
    // Get day name based on day number
    const getDayName = (dayNum) => {
        const dayNames = {
            1: 'Monday (Week A)', 2: 'Tuesday (Week A)', 3: 'Wednesday (Week A)', 4: 'Thursday (Week A)', 5: 'Friday (Week A)',
            6: 'Monday (Week B)', 7: 'Tuesday (Week B)', 8: 'Wednesday (Week B)', 
            9: 'Thursday (Week B)', 10: 'Friday (Week B)'
        };
        return dayNames[dayNum] || `Day ${dayNum}`;
    };
    
    // Handle day selection with improved event handling
    const handleDayChange = (event, day) => {
        event.preventDefault();
        event.stopPropagation();
        
        console.log("Switching to day:", day);
        setCurrentDay(day);
        // Close any open editing form when switching days
        setCurrentEditingSlot(null);
    };

    useEffect(() => {
        // Load templates on component mount
        const templateNames = timetableService.getTemplateNames();
        setTemplates(templateNames);
        
        // Load the school template by default
        if (templateNames.includes('school')) {
            loadTemplate('school');
        }

        // Set current day based on today's date
        const todayDay = getCurrentSchoolDay();
        setCurrentDay(todayDay); // Automatically select today's day
        console.log(`Today is day ${todayDay}`);
        
        // Set current period based on current time
        const nowPeriod = getCurrentPeriod();
        setCurrentPeriod(nowPeriod);
        console.log(`Current period is ${nowPeriod}`);
        
        // Check if break periods should be visible
        const showRecess = shouldShowBreakPeriod('Recess');
        const showLunch = shouldShowBreakPeriod('Lunch');
        setVisiblePeriods({
            Recess: showRecess,
            Lunch: showLunch
        });
        
        // Update current period and break visibility every minute
        const updateInterval = setInterval(() => {
            const updatedPeriod = getCurrentPeriod();
            console.log(`Updating current period to: ${updatedPeriod}`);
            setCurrentPeriod(updatedPeriod);
            
            // Update break period visibility
            const updatedShowRecess = shouldShowBreakPeriod('Recess');
            const updatedShowLunch = shouldShowBreakPeriod('Lunch');
            setVisiblePeriods({
                Recess: updatedShowRecess,
                Lunch: updatedShowLunch
            });
        }, 30000); // check every 30 seconds for more responsive UI

        // Clean up on unmount
        return () => {
            clearInterval(updateInterval);
        };

        // Load display settings from localStorage
        const savedSettings = localStorage.getItem('timetable-settings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                setDisplaySettings({
                    displayCode: parsedSettings.displayCode !== undefined ? parsedSettings.displayCode : true,
                    displayTeacher: parsedSettings.displayTeacher !== undefined ? parsedSettings.displayTeacher : true,
                    displayRoom: parsedSettings.displayRoom !== undefined ? parsedSettings.displayRoom : true,
                    useFirstNameForTeachers: parsedSettings.useFirstNameForTeachers || false
                });
            } catch (error) {
                console.error('Error parsing settings:', error);
            }
        }
    }, []);
    
    // Handle importing timetable data
    const importTimetable = (data) => {
        console.log('Importing timetable data:', data);
        if (!data) return;
        
        // Convert the imported data to time slots
        const convertedSlots = convertStructuredDataToTimeSlots(data);
        
        if (convertedSlots && convertedSlots.length > 0) {
            // Clear existing timetable first
            timetableService.clearTimetable();
            
            // Add each time slot to the service
            convertedSlots.forEach(slot => {
                timetableService.addTimeSlot(slot);
            });
            
            // Update the UI
            setTimeSlots(convertedSlots);
            
            // Show success notification
            alert('Timetable imported successfully!');
        } else {
            alert('Failed to import timetable. The data format may be incorrect.');
        }
    };

    // Check if user has admin privileges
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (user && user.uid) {
                try {
                    const adminStatus = await isAdmin(user.uid);
                    setIsAdminUser(adminStatus);
                } catch (error) {
                    console.error('Error checking admin status:', error);
                    setIsAdminUser(false);
                }
            } else {
                setIsAdminUser(false);
            }
        };
        
        checkAdminStatus();
    }, [user]);

    useEffect(() => {
        if (currentEditingSlot && editingRowRef.current) {
            // Get the height of the row being edited
            const height = editingRowRef.current.clientHeight;
            setEditingRowHeight(height);
        } else {
            setEditingRowHeight(null);
        }
    }, [currentEditingSlot]);

    const loadTemplate = (templateName) => {
        timetableService.loadTemplate(templateName);
        setTimeSlots(timetableService.getTimeSlots());
        setCurrentTemplate(templateName);
        // Close any open editing form when loading a template
        setCurrentEditingSlot(null);
    };

    const saveTemplate = () => {
        if (newTemplateName.trim()) {
            timetableService.saveAsTemplate(newTemplateName);
            setTemplates(timetableService.getTemplateNames());
            setNewTemplateName('');
            setCurrentTemplate(newTemplateName);
        }
    };
    
    const deleteTemplate = (templateName) => {
        // Don't delete built-in templates
        if (templateName === 'school') {
            alert('The default school template cannot be deleted.');
            return;
        }
        
        // Confirm deletion
        if (window.confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
            const success = timetableService.deleteTemplate(templateName);
            if (success) {
                // Update template list
                setTemplates(timetableService.getTemplateNames());
                
                // If the deleted template was the current template, switch to the school template
                if (currentTemplate === templateName) {
                    loadTemplate('school');
                }
                
                alert(`Template "${templateName}" has been deleted.`);
            }
        }
    };

    const handleImportData = (importedData) => {
        try {
            console.log("Received import data:", importedData);
            
            // Check if data is already in the correct structured format (from AI tab)
            if (importedData && typeof importedData === 'object' && !Array.isArray(importedData) && 
                importedData.days && importedData.periods && importedData.classes) {
                console.log("Received structured data from AI tab");
                // This is already structured data from the AI tab
                const slots = convertStructuredDataToTimeSlots(importedData);
                
                if (!slots || slots.length === 0) {
                    console.error("Failed to convert structured data to time slots");
                    alert('Failed to process the structured data. The data format may be invalid or incomplete.');
                    return;
                }
                
                console.log(`Successfully converted ${slots.length} classes to time slots`);
                timetableService.clearTimetable();
                slots.forEach(slot => {
                    timetableService.addTimeSlot(slot);
                });
                // Ensure recess and lunch periods are preserved
                timetableService.preserveBreakPeriods();
                setTimeSlots(timetableService.getTimeSlots());
                alert(`Timetable imported successfully! Added ${slots.length} classes.`);
                return;
            }
            // Raw text input - parse it
            else if (typeof importedData === 'string') {
                if (!importedData.trim()) {
                    alert('The imported text is empty. Please provide timetable data.');
                    return;
                }
                
                console.log("Parsing raw text input");
                const parsedData = parseTimetable(importedData);
                
                // Check if the parsed data has necessary structure
                if (!parsedData || !parsedData.days || parsedData.days.length === 0) {
                    console.error("Failed to extract days from timetable data");
                    alert('Could not identify days in your timetable. Please check the format.');
                    return;
                }
                
                if (!parsedData.periods || parsedData.periods.length === 0) {
                    console.error("Failed to extract periods from timetable data");
                    alert('Could not identify periods in your timetable. Please check the format.');
                    return;
                }
                
                console.log(`Parsed data has ${parsedData.days.length} days and ${parsedData.periods.length} periods`);
                
                // Check if any classes were parsed
                let totalClasses = 0;
                Object.keys(parsedData.classes).forEach(day => {
                    Object.keys(parsedData.classes[day] || {}).forEach(period => {
                        totalClasses += (parsedData.classes[day][period] || []).length;
                    });
                });
                
                if (totalClasses === 0) {
                    console.error("No classes were found in the parsed data");
                    alert('No classes were found in your timetable. Please check the format.');
                    return;
                }
                
                console.log(`Found ${totalClasses} classes in parsed data`);
                
                const slots = convertStructuredDataToTimeSlots(parsedData);
                if (!slots || slots.length === 0) {
                    console.error("Failed to convert parsed data to time slots");
                    alert('Failed to process the parsed data. The data may be in an incorrect format.');
                    return;
                }
                
                console.log(`Successfully converted ${slots.length} classes to time slots`);
                timetableService.clearTimetable();
                slots.forEach(slot => {
                    timetableService.addTimeSlot(slot);
                });
                // Ensure recess and lunch periods are preserved
                timetableService.preserveBreakPeriods();
                setTimeSlots(timetableService.getTimeSlots());
                alert(`Timetable parsed and imported successfully! Added ${slots.length} classes.`);
                return;
            }
            // Legacy format with timeSlots array
            else if (importedData.timeSlots) {
                timetableService.clearTimetable();
                importedData.timeSlots.forEach(slot => {
                    timetableService.addTimeSlot(slot);
                });
                // Ensure recess and lunch periods are preserved
                timetableService.preserveBreakPeriods();
                setTimeSlots(timetableService.getTimeSlots());
                alert('Timetable imported successfully!');
                return;
            }
            
            // If we get here, we couldn't process the data
            alert('The imported file does not contain any timetable data in a recognized format.');
        } catch (error) {
            console.error('Error processing imported data:', error);
            alert('Failed to process the imported timetable data: ' + error.message);
        }
    };

    const addTimeSlot = () => {
        const newSlot = { 
            id: Date.now(), 
            day: currentDay,
            period: '', 
            subject: '', 
            startTime: '', 
            endTime: '',
            room: '',
            teacher: '',
            code: ''
        };
        
        timetableService.addTimeSlot(newSlot);
        setTimeSlots([...timeSlots, newSlot]);
    };

    const updateTimeSlot = (id, updatedSlot) => {
        const index = timeSlots.findIndex(slot => 
            slot.id === id || `${slot.day}-${slot.period}` === id
        );
        
        if (index !== -1) {
            console.log('Updating time slot at index:', index);
            console.log('Old slot:', timeSlots[index]);
            console.log('New slot:', updatedSlot);
            
            // Ensure we preserve the day and period values from the original slot
            const finalUpdatedSlot = {
                ...updatedSlot,
                day: timeSlots[index].day,
                period: timeSlots[index].period
            };
            
            // Update the slot in the service
            timetableService.editTimeSlot(index, finalUpdatedSlot);
            
            // Update the state immutably
            const updatedSlots = [...timeSlots];
            updatedSlots[index] = finalUpdatedSlot;
            setTimeSlots(updatedSlots);
            
            console.log('Updated slots array:', updatedSlots);
        }
        
        // Close the editing form
        setCurrentEditingSlot(null);
    };

    const removeTimeSlot = (id) => {
        const index = timeSlots.findIndex(slot => 
            slot.id === id || `${slot.day}-${slot.period}` === id
        );
        
        if (index !== -1) {
            timetableService.deleteTimeSlot(index);
            const updatedSlots = [...timeSlots];
            updatedSlots.splice(index, 1);
            setTimeSlots(updatedSlots);
        }
        
        // If the removed slot was being edited, close the editing form
        if (currentEditingSlot === id) {
            setCurrentEditingSlot(null);
        }
    };

    // Handle when a user starts editing a slot
    const handleStartEditing = (id) => {
        console.log('Starting edit for slot:', id);
        // Enable edit mode if not already enabled
        if (!editMode) {
            setEditMode(true);
        }
        setCurrentEditingSlot(id);
    };
    
    // Handle when a user cancels editing
    const handleCancelEditing = () => {
        console.log('Canceling edit');
        setCurrentEditingSlot(null);
    };

    // Get all periods for the selected day
    const getPeriods = () => {
        // Start with all non-break periods
        const allPeriods = ['1', '2', 'Tutorial', '3', '4', '5', 'After School'];
        
        // Only insert break periods if they should be visible or we're in edit mode
        if (visiblePeriods.Recess || editMode) {
            // Insert Recess after Tutorial
            allPeriods.splice(3, 0, 'Recess');
        }
        
        if (visiblePeriods.Lunch || editMode) {
            // Insert Lunch after period 4
            allPeriods.splice(allPeriods.indexOf('4') + 1, 0, 'Lunch');
        }
        
        return allPeriods;
    };

    // Filter slots by day and period
    const filterSlots = (day, period) => {
        return timeSlots.filter(slot => 
            slot.day === day && 
            String(slot.period) === String(period)
        );
    };

    // Store a reference to each period's corresponding label
    const getPeriodLabelRef = (period) => {
        if (!labelRefs.current[period]) {
            labelRefs.current[period] = React.createRef();
        }
        return labelRefs.current[period];
    };

    return (
        <div className="timetable-container">
            <div className="timetable-header">
                <h2>School Timetable</h2>
                <div className="current-day-display">
                    <span>{getDayName(currentDay)}</span>
                </div>
                
                <div className="template-controls">
                    <select 
                        value={currentTemplate} 
                        onChange={(e) => loadTemplate(e.target.value)}
                    >
                        <option value="">Templates</option>
                        {templates.map(template => (
                            <option key={template} value={template}>
                                {template.charAt(0).toUpperCase() + template.slice(1)}
                            </option>
                        ))}
                    </select>
                    
                    <div className="save-template">
                        <input 
                            type="text" 
                            placeholder="Template Name" 
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                        />
                        <button onClick={saveTemplate}>Save</button>
                    </div>
                    
                    {currentTemplate && currentTemplate !== 'school' && (
                        <button 
                            className="delete-template-btn" 
                            onClick={() => deleteTemplate(currentTemplate)}
                        >
                            Delete
                        </button>
                    )}
                    
                    <button 
                        className={`edit-mode-toggle ${editMode ? 'active' : ''}`}
                        onClick={() => {
                            setEditMode(!editMode);
                            // Close any open editing form when toggling edit mode
                            setCurrentEditingSlot(null);
                        }}
                    >
                        {editMode ? 'View Mode' : 'Edit Mode'}
                    </button>
                    
                    {isAdminUser && (
                        <button 
                            className="admin-button" 
                            onClick={() => setShowAdminTerminal(true)}
                        >
                            Admin
                        </button>
                    )}
                    
                    <ImportButton onImport={importTimetable} />
                </div>
                
                {editMode && (
                    <div className="edit-mode-hint">
                        <p>Click directly on any class to edit its details, or use the <span className="edit-button-hint">Edit</span> button</p>
                    </div>
                )}
                
                <div className="day-selector">
                    {days.map(day => {
                        // Get today's real school day number
                        const todayDay = getCurrentSchoolDay();
                        const isToday = day === todayDay;
                        
                        return (
                            <button 
                                key={day} 
                                type="button"
                                className={`day-button ${currentDay === day ? 'active' : ''} ${isToday ? 'current-day' : ''}`}
                                onClick={(e) => handleDayChange(e, day)}
                                title={`${getDayName(day)}${isToday ? ' (Today)' : ''}`}
                            >
                                <span>Day {day}</span>
                                {isToday && <span className="today-text">Today</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="timetable">
                <div className="periods-column">
                    {getPeriods().map(period => {
                        const isEditingThisPeriod = filterSlots(currentDay, period).some(
                            slot => currentEditingSlot === (slot.id || `${slot.day}-${slot.period}`)
                        );
                        
                        return (
                            <div 
                                key={period} 
                                className={`period-label ${isEditingThisPeriod ? 'editing' : ''}`}
                                data-period={period}
                                ref={getPeriodLabelRef(period)}
                                style={isEditingThisPeriod && editingRowHeight ? { height: `${editingRowHeight}px` } : {}}
                            >
                                <span>{period}</span>
                                {period === '1' && <span className="time">8:35am–9:35am</span>}
                                {period === '2' && <span className="time">9:35am–10:35am</span>}
                                {period === 'Tutorial' && <span className="time">10:35am–11:05am</span>}
                                {period === 'Recess' && <span className="time">10:55am–11:25am</span>}
                                {period === '3' && <span className="time">11:30am–12:30pm</span>}
                                {period === '4' && <span className="time">12:30pm–1:30pm</span>}
                                {period === 'Lunch' && <span className="time">1:30pm–2:25pm</span>}
                                {period === '5' && <span className="time">2:25pm–3:25pm</span>}
                                {period === 'After School' && <span className="time">3:35pm–4:30pm</span>}
                            </div>
                        );
                    })}
                </div>
                
                <div className="day-column">
                    {getPeriods().map(period => {
                        const isEditingThisPeriod = filterSlots(currentDay, period).some(
                            slot => currentEditingSlot === (slot.id || `${slot.day}-${slot.period}`)
                        );
                        
                        return (
                            <div 
                                key={period} 
                                className={`period-row ${isEditingThisPeriod ? 'has-editing-slot' : ''}`}
                                data-period={period}
                                ref={isEditingThisPeriod ? editingRowRef : null}
                            >
                                {filterSlots(currentDay, period).map(slot => (
                                    <TimeSlot
                                        key={slot.id || `${slot.day}-${slot.period}`}
                                        slot={slot}
                                        onUpdate={updateTimeSlot}
                                        onRemove={removeTimeSlot}
                                        isEditing={currentEditingSlot === (slot.id || `${slot.day}-${slot.period}`)}
                                        onStartEditing={handleStartEditing}
                                        onCancelEditing={handleCancelEditing}
                                        displaySettings={displaySettings}
                                        isCurrentPeriod={currentPeriod !== null && slot.day === getCurrentSchoolDay() && String(slot.period) === String(currentPeriod)}
                                    />
                                ))}
                                
                                {editMode && filterSlots(currentDay, period).length === 0 && (
                                    <div className="add-time-slot">
                                        <button 
                                            onClick={() => {
                                                const newSlot = {
                                                    day: currentDay,
                                                    period: period,
                                                    startTime: period === '1' ? '8:35am' :
                                                              period === '2' ? '9:35am' :
                                                              period === 'Tutorial' ? '10:35am' :
                                                              period === '3' ? '11:30am' :
                                                              period === '4' ? '12:30pm' :
                                                              period === '5' ? '2:25pm' : '3:35pm',
                                                    endTime: period === '1' ? '9:35am' :
                                                             period === '2' ? '10:35am' :
                                                             period === 'Tutorial' ? '11:05am' :
                                                             period === '3' ? '12:30pm' :
                                                             period === '4' ? '1:30pm' :
                                                             period === '5' ? '3:25pm' : '4:30pm',
                                                    subject: '',
                                                    code: '',
                                                    room: '',
                                                    teacher: ''
                                                };
                                                
                                                timetableService.addTimeSlot(newSlot);
                                                setTimeSlots([...timeSlots, newSlot]);
                                            }}
                                        >
                                            + Add Class
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Admin Terminal */}
            {showAdminTerminal && (
                <AdminTerminal onClose={() => setShowAdminTerminal(false)} />
            )}
        </div>
    );
};

export default Timetable;