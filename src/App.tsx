/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  History, 
  Pill, 
  Bell,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Settings,
  Droplets,
  Zap,
  Camera,
  Mic,
  Volume2,
  MoreVertical,
  Edit3,
  Check,
  X,
  LayoutDashboard,
  CalendarDays,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parse,
  addMinutes,
  subMinutes,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type TaskType = 'MED' | 'SUPP' | 'WATER' | 'EXERCISE';
type MealRelation = 'NONE' | 'BEFORE_BREAKFAST' | 'AFTER_BREAKFAST' | 'BEFORE_LUNCH' | 'AFTER_LUNCH' | 'BEFORE_DINNER' | 'AFTER_DINNER';

interface Task {
  id: string;
  type: TaskType;
  name: string;
  dosage: string;
  category?: string; // For health tips
  frequency: number; // 1, 2, 3, 4
  reminders: {
    time: string;
    mealRelation: MealRelation;
    lastReminderDate?: string;
  }[];
  isActive: boolean;
  photo?: string;
  voiceType: 'SYSTEM' | 'CUSTOM';
  customVoice?: string;
  nextRetryTime?: number;
  notes?: string;
  isInterval?: boolean;
  intervalHours?: number;
  startTime?: string;
  endTime?: string;
}

interface MealSettings {
  breakfast: string;
  lunch: string;
  dinner: string;
}

interface Log {
  id: string;
  taskId: string;
  taskName: string;
  taskType: TaskType;
  dosage: string;
  status: 'taken' | 'missed';
  timestamp: number;
  reminderTime?: string; // Track which specific dose was taken
}

// --- Constants ---
const DEFAULT_MEAL_SETTINGS: MealSettings = {
  breakfast: '07:30',
  lunch: '12:00',
  dinner: '18:30'
};

const COMMON_MEDS = [
  {
    category: "高血压",
    items: ["托平胶囊", "厄贝沙坦片", "诺欣妥片", "雅施达片 (培哚普利)", "施慧达片", "安博诺片", "盐酸哌唑嗪片", "伲福达片", "复代文片", "拜新同片", "搏立高片", "亚尼安片", "苯磺酸左氨氯地平片", "合贝爽缓释胶囊 (盐酸地尔硫卓缓释胶囊)", "维拉帕米", "(美托洛尔) 倍他乐克缓释片", "倍他乐克片"]
  },
  {
    category: "高血糖",
    items: ["达格列净片", "贝希胶囊", "二甲双胍片", "阿卡波糖片"]
  },
  {
    category: "高血脂",
    items: ["美达信片", "普伐他汀片", "依折麦布片", "海舒严片", "瑞百安针", "立普 (阿托伐他汀)"]
  }
];

const HEALTH_TIPS: Record<string, { icon: string, avoid: string[], suggest: string[], avoidTitle: string, suggestTitle: string }> = {
  "高血压": {
    icon: "🫀",
    avoidTitle: "🚫 忌口重点（低盐最核心）",
    avoid: ["咸菜、榨菜、泡菜", "腊肉、香肠、培根、火腿", "方便面、速食汤、罐头食品", "火锅底料、酱料（酱油、蚝油、豆瓣酱）", "外卖重口味菜（麻辣香锅、卤味）", "咸零食（薯片、坚果盐焗类）"],
    suggestTitle: "✅ 建议多吃（高钾 + 清淡）",
    suggest: ["🥬 绿叶菜（菠菜、油麦菜、生菜、芥蓝）", "🍅 蔬菜（番茄、黄瓜、西兰花、冬瓜）", "🍌 水果（香蕉、橙子、猕猴桃、火龙果）", "🥔 薯类（土豆、红薯、山药）", "🌾 粗粮（燕麦、糙米、玉米）", "🥣 清淡食物（蒸鱼、白灼菜、炖汤）"]
  },
  "高血糖": {
    icon: "🍬",
    avoidTitle: "🚫 忌口重点（控糖 + 控精制碳水）",
    avoid: ["奶茶、含糖饮料、果汁", "蛋糕、面包、甜点、冰淇淋", "白米饭过量、白粥、糯米制品", "油条、炸糕等高GI主食", "高糖水果（榴莲、荔枝、龙眼、葡萄过量）", "甜味零食（饼干、糖果）"],
    suggestTitle: "✅ 建议多吃（低GI + 高纤维）",
    suggest: ["🌾 粗粮（燕麦、糙米、藜麦、全麦面包）", "🥦 蔬菜（西兰花、菠菜、苦瓜、芹菜）", "🥒 低糖蔬菜（黄瓜、西红柿、生菜）", "🍗 蛋白质（鸡蛋、鸡胸肉、鱼、豆腐）", "🥜 坚果（杏仁、核桃，少量）", "🍎 低糖水果（苹果、梨、蓝莓、草莓）"]
  },
  "高血脂": {
    icon: "🧈",
    avoidTitle: "🚫 忌口重点（减少坏脂肪）",
    avoid: ["油炸食品（炸鸡、薯条、油条）", "肥肉、五花肉、猪油", "动物内脏（肝、肠、脑）", "奶油、黄油、芝士（过量）", "蛋糕、饼干（含反式脂肪）", "加工肉制品（香肠、培根）"],
    suggestTitle: "✅ 建议多吃（好脂肪 + 降脂食物）",
    suggest: ["🐟 深海鱼（三文鱼、沙丁鱼、金枪鱼）", "🫒 植物油（橄榄油、亚麻籽油）", "🥜 坚果（核桃、杏仁、腰果，少量）", "🥦 蔬菜（西兰花、胡萝卜、茄子）", "🌾 粗粮（燕麦、全麦）", "🍎 水果（苹果、柑橘类）", "🫘 豆类（黄豆、黑豆、豆腐）"]
  }
};

export default function App() {
  // --- State ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('meds_tasks_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [mealSettings, setMealSettings] = useState<MealSettings>(() => {
    const saved = localStorage.getItem('meds_meal_settings');
    return saved ? JSON.parse(saved) : DEFAULT_MEAL_SETTINGS;
  });

  const [logs, setLogs] = useState<Log[]>(() => {
    const saved = localStorage.getItem('meds_logs_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [view, setView] = useState<'dashboard' | 'tasks' | 'history' | 'health'>('dashboard');
  const [isAdding, setIsAdding] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [entryMode, setEntryMode] = useState<'SELECT' | 'MANUAL'>('SELECT');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Form State
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    type: 'MED',
    name: '',
    dosage: '',
    frequency: 1,
    reminders: [{ time: '08:00', mealRelation: 'NONE' }],
    voiceType: 'SYSTEM',
    notes: '',
    isInterval: false,
    intervalHours: 2,
    startTime: '08:00',
    endTime: '22:00'
  });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Reminder State
  const [activeReminder, setActiveReminder] = useState<Task | null>(null);
  const [activeReminderSlot, setActiveReminderSlot] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('meds_tasks_v2', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('meds_meal_settings', JSON.stringify(mealSettings));
  }, [mealSettings]);

  useEffect(() => {
    localStorage.setItem('meds_logs_v2', JSON.stringify(logs));
  }, [logs]);

  // --- Voice Synthesis ---
  const speak = useCallback((text: string, task?: Task) => {
    if (task?.voiceType === 'CUSTOM' && task.customVoice) {
      const audio = new Audio(task.customVoice);
      audio.play().catch(err => console.error("Audio play failed:", err));
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any current speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // --- Core Logic: Reminder Timer ---
  useEffect(() => {
    const checkReminders = () => {
      if (activeReminder) return; // Don't trigger if one is already active

      const now = new Date();
      const currentTimeStr = format(now, 'HH:mm');
      const currentDateStr = format(now, 'yyyy-MM-dd');
      const nowTimestamp = now.getTime();

      tasks.forEach(task => {
        if (!task.isActive) return;

        task.reminders.forEach((reminder, index) => {
          // Check if already completed today via logs
          const isCompleted = logs.some(log => 
            log.taskId === task.id && 
            isSameDay(new Date(log.timestamp), now) &&
            log.reminderTime === reminder.time &&
            log.status === 'taken'
          );

          if (isCompleted) return;

          // Check for normal time match
          const isTimeMatch = reminder.time === currentTimeStr && reminder.lastReminderDate !== currentDateStr;
          
          // Check for retry match (every 5 mins if not finished)
          const isRetryMatch = task.nextRetryTime && nowTimestamp >= task.nextRetryTime;

          if (isTimeMatch || isRetryMatch) {
            setActiveReminder(task);
            setActiveReminderSlot(index);
            
            // Voice broadcast
            const categoryName = task.type === 'MED' ? '药品' : task.type === 'SUPP' ? '补品' : task.type === 'WATER' ? '喝水' : '运动/学习';
            const msg = `${categoryName}提醒：该服用${task.name}了，剂量是${task.dosage}。`;
            speak(msg, task);

            // Update last reminder date for this specific reminder slot
            setTasks(prev => prev.map(t => {
              if (t.id === task.id) {
                const newReminders = [...t.reminders];
                newReminders[index] = { ...newReminders[index], lastReminderDate: currentDateStr };
                return { ...t, reminders: newReminders, nextRetryTime: isRetryMatch ? undefined : t.nextRetryTime };
              }
              return t;
            }));
          }
        });
      });
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [tasks, speak]);

  // --- Helpers ---
  const calculateTaskTime = (relation: MealRelation, settings: MealSettings, manualTime?: string): string => {
    if (relation === 'NONE') return manualTime || '08:00';
    
    let baseTime = '';
    let offset = 30; // default 30 mins

    if (relation.includes('BREAKFAST')) baseTime = settings.breakfast;
    else if (relation.includes('LUNCH')) baseTime = settings.lunch;
    else if (relation.includes('DINNER')) baseTime = settings.dinner;

    const [hours, minutes] = baseTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    const resultDate = relation.startsWith('BEFORE') 
      ? subMinutes(date, offset) 
      : addMinutes(date, offset);

    return format(resultDate, 'HH:mm');
  };

  const getNextReminder = useMemo(() => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    const allReminders = tasks
      .filter(t => t.isActive)
      .flatMap(t => t.reminders.map(r => ({ ...t, ...r })))
      .sort((a, b) => a.time.localeCompare(b.time));
    
    const next = allReminders.find(r => r.time > currentTime);
    return next || allReminders[0];
  }, [tasks]);

  const streakCount = useMemo(() => {
    // Simple streak calculation based on logs
    let count = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      const d = subMinutes(today, i * 24 * 60);
      const hasTaken = logs.some(l => l.status === 'taken' && isSameDay(new Date(l.timestamp), d));
      if (hasTaken) count++;
      else if (i > 0) break;
    }
    return count;
  }, [logs]);

  // --- Actions ---
  const saveTask = () => {
    const isLightweight = taskForm.type === 'WATER' || taskForm.type === 'EXERCISE';
    const defaultName = taskForm.type === 'WATER' ? '喝水' : '运动/学习';
    
    if (!isLightweight && (!taskForm.name || !taskForm.dosage)) return;
    if (isLightweight && (!taskForm.reminders || taskForm.reminders.length === 0)) return;

    const finalName = taskForm.name || defaultName;
    const finalDosage = isLightweight ? (taskForm.type === 'WATER' ? '200ml' : '30分钟') : (taskForm.dosage || '');

    const finalReminders = taskForm.isInterval && taskForm.type === 'WATER' 
      ? (() => {
          const reminders: { time: string; mealRelation: MealRelation }[] = [];
          const start = parse(taskForm.startTime || '08:00', 'HH:mm', new Date());
          const end = parse(taskForm.endTime || '22:00', 'HH:mm', new Date());
          const interval = (taskForm.intervalHours || 2) * 60;
          
          let current = start;
          while (isBefore(current, end) || format(current, 'HH:mm') === format(end, 'HH:mm')) {
            reminders.push({ time: format(current, 'HH:mm'), mealRelation: 'NONE' });
            current = addMinutes(current, interval);
          }
          return reminders;
        })()
      : (taskForm.reminders || []).map(r => ({
          ...r,
          time: calculateTaskTime(r.mealRelation, mealSettings, r.time)
        }));

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskForm, name: finalName, dosage: finalDosage, reminders: finalReminders } as Task : t));
    } else {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        type: taskForm.type || 'MED',
        name: finalName,
        dosage: finalDosage,
        category: taskForm.category, // Save category for health tips
        frequency: taskForm.frequency || 1,
        reminders: finalReminders,
        isActive: true,
        voiceType: taskForm.voiceType || 'SYSTEM',
        customVoice: taskForm.customVoice,
        photo: taskForm.photo,
        notes: taskForm.notes,
        isInterval: taskForm.isInterval,
        intervalHours: taskForm.intervalHours,
        startTime: taskForm.startTime,
        endTime: taskForm.endTime
      };
      setTasks([...tasks, newTask]);
    }
    
    setIsAdding(false);
    setEditingTask(null);
    setSelectedCategory(null);
    setTaskForm({ 
      type: 'MED', 
      name: '', 
      dosage: '', 
      frequency: 1, 
      reminders: [{ time: '08:00', mealRelation: 'NONE' }], 
      voiceType: 'SYSTEM', 
      notes: '',
      isInterval: false,
      intervalHours: 2,
      startTime: '08:00',
      endTime: '22:00'
    });
  };

  const handleConfirm = (status: 'taken' | 'missed') => {
    if (!activeReminder) return;

    if (status === 'taken') {
      const log: Log = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: activeReminder.id,
        taskName: activeReminder.name,
        taskType: activeReminder.type,
        dosage: activeReminder.dosage,
        status: 'taken',
        timestamp: Date.now(),
        reminderTime: activeReminderSlot !== null ? activeReminder.reminders[activeReminderSlot].time : undefined
      };
      setLogs([log, ...logs]);
      
      setTasks(prev => prev.map(t => {
        if (t.id === activeReminder.id) {
          const newReminders = [...t.reminders];
          if (activeReminderSlot !== null) {
            newReminders[activeReminderSlot] = { 
              ...newReminders[activeReminderSlot], 
              lastReminderDate: format(new Date(), 'yyyy-MM-dd') 
            };
          }
          return { ...t, nextRetryTime: undefined, reminders: newReminders };
        }
        return t;
      }));
      setActiveReminder(null);
      setActiveReminderSlot(null);
    } else {
      // If missed/not finished, set a retry for 5 minutes later
      // But only for MED type (Strong reminder)
      if (activeReminder.type === 'MED') {
        const nextRetry = Date.now() + 5 * 60 * 1000;
        setTasks(prev => prev.map(t => 
          t.id === activeReminder.id ? { ...t, nextRetryTime: nextRetry } : t
        ));
        setActiveReminder(null);
        setActiveReminderSlot(null);
      } else {
        // Light reminder just logs as missed
        const log: Log = {
          id: Math.random().toString(36).substr(2, 9),
          taskId: activeReminder.id,
          taskName: activeReminder.name,
          taskType: activeReminder.type,
          dosage: activeReminder.dosage,
          status: 'missed',
          timestamp: Date.now(),
          reminderTime: activeReminderSlot !== null ? activeReminder.reminders[activeReminderSlot].time : undefined
        };
        setLogs([log, ...logs]);
        setTasks(prev => prev.map(t => 
          t.id === activeReminder.id ? { ...t, lastReminderDate: format(new Date(), 'yyyy-MM-dd') } : t
        ));
        setActiveReminder(null);
        setActiveReminderSlot(null);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTaskForm({ ...taskForm, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setTaskForm(prev => ({ ...prev, customVoice: reader.result as string }));
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (taskForm.customVoice) {
      const audio = new Audio(taskForm.customVoice);
      audio.play();
    }
  };

  const clearHistory = () => {
    setLogs([]);
    setTasks([]);
    setShowClearConfirm(false);
  };

  // --- Calendar Logic ---
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const logsForSelectedDate = useMemo(() => {
    return logs.filter(log => isSameDay(new Date(log.timestamp), selectedDate));
  }, [logs, selectedDate]);

  const todaySchedule = useMemo(() => {
    const schedule: { task: Task; reminderIndex: number; time: string; isCompleted: boolean }[] = [];
    
    tasks.forEach(task => {
      if (!task.isActive) return;
      task.reminders.forEach((reminder, index) => {
        const isCompleted = logs.some(log => 
          log.taskId === task.id && 
          isSameDay(new Date(log.timestamp), new Date()) &&
          log.reminderTime === reminder.time &&
          log.status === 'taken'
        );
        schedule.push({
          task,
          reminderIndex: index,
          time: reminder.time,
          isCompleted
        });
      });
    });
    
    return schedule.sort((a, b) => a.time.localeCompare(b.time));
  }, [tasks, logs]);

  const toggleTaskCompletion = (task: Task, reminderIndex: number) => {
    const reminder = task.reminders[reminderIndex];
    const isCompleted = logs.some(log => 
      log.taskId === task.id && 
      isSameDay(new Date(log.timestamp), new Date()) &&
      log.reminderTime === reminder.time &&
      log.status === 'taken'
    );

    if (isCompleted) {
      // Remove the log
      setLogs(prev => prev.filter(log => 
        !(log.taskId === task.id && 
          isSameDay(new Date(log.timestamp), new Date()) &&
          log.reminderTime === reminder.time)
      ));
    } else {
      // Add a log
      const log: Log = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: task.id,
        taskName: task.name,
        taskType: task.type,
        dosage: task.dosage,
        status: 'taken',
        timestamp: Date.now(),
        reminderTime: reminder.time
      };
      setLogs([log, ...logs]);

      // If this task is currently showing as a reminder, clear it
      if (activeReminder?.id === task.id && activeReminderSlot === reminderIndex) {
        setActiveReminder(null);
        setActiveReminderSlot(null);
      }

      // Also mark as reminded for today to prevent popup if it hasn't fired yet
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          const newReminders = [...t.reminders];
          newReminders[reminderIndex] = { 
            ...newReminders[reminderIndex], 
            lastReminderDate: format(new Date(), 'yyyy-MM-dd') 
          };
          return { ...t, reminders: newReminders, nextRetryTime: undefined };
        }
        return t;
      }));
    }
  };

  const itemLabel = taskForm.type === 'MED' ? '药品' : taskForm.type === 'SUPP' ? '补品' : taskForm.type === 'EXERCISE' ? '运动/学习' : '项目';

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans pb-24 selection:bg-primary selection:text-white overflow-x-hidden">
      
      {/* --- Header --- */}
      <header className="bg-white px-6 pt-12 pb-6 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] sticky top-0 z-30">
        <div className="flex justify-between items-end max-w-md mx-auto">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">记得</h1>
            <p className="text-gray-400 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">
              {format(new Date(), 'yyyy / MM / dd • EEEE', { locale: zhCN })}
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setView('health')}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                view === 'health' ? "bg-primary text-white shadow-xl" : "bg-gray-50 text-gray-400 hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Heart size={20} />
            </button>
            <button 
              onClick={() => { 
                setEditingTask(null); 
                setSelectedCategory(null);
                setTaskForm({ 
                  type: 'MED', 
                  name: '', 
                  dosage: '', 
                  frequency: 1, 
                  reminders: [{ time: '08:00', mealRelation: 'NONE' }], 
                  voiceType: 'SYSTEM', 
                  notes: '',
                  isInterval: false,
                  intervalHours: 2,
                  startTime: '08:00',
                  endTime: '22:00'
                }); 
                setIsAdding(true); 
              }}
              className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="p-6 max-w-md mx-auto">
        
        {/* View: Dashboard */}
        {view === 'dashboard' && (
          <div className="space-y-8">
            {/* Simplified Today's Schedule */}
            <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter italic serif text-primary leading-none">今日安排</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mt-2">TODAY'S SCHEDULE • {format(new Date(), 'MM/dd')}</p>
                </div>
                <button onClick={() => setView('tasks')} className="text-[10px] font-black uppercase text-primary border-b border-primary/20 pb-1">管理全部</button>
              </div>

              <div className="space-y-4">
                {todaySchedule.length > 0 ? (
                  todaySchedule.map((item, idx) => (
                    <motion.div 
                      key={`${item.task.id}-${item.reminderIndex}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between transition-all",
                        item.isCompleted && "opacity-50 grayscale-[0.5]"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                          item.task.type === 'MED' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                        )}>
                          {item.task.type === 'MED' ? <Pill size={20} /> : item.task.type === 'WATER' ? <Droplets size={20} /> : <Zap size={20} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 italic serif">{item.time}</p>
                          <h3 className="font-black text-lg leading-none uppercase tracking-tight">{item.task.name}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{item.task.dosage}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => toggleTaskCompletion(item.task, item.reminderIndex)}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all",
                          item.isCompleted 
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                            : "border-gray-100 text-transparent hover:border-primary/20"
                        )}
                      >
                        <Check size={20} strokeWidth={4} />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-3xl font-black uppercase italic opacity-10">今日无安排</p>
                    <button 
                      onClick={() => { 
                        setEditingTask(null); 
                        setSelectedCategory(null);
                        setTaskForm({ 
                          type: 'MED', 
                          name: '', 
                          dosage: '', 
                          frequency: 1, 
                          reminders: [{ time: '08:00', mealRelation: 'NONE' }], 
                          voiceType: 'SYSTEM', 
                          notes: '',
                          isInterval: false,
                          intervalHours: 2,
                          startTime: '08:00',
                          endTime: '22:00'
                        }); 
                        setIsAdding(true); 
                      }}
                      className="mt-6 text-[10px] font-black uppercase text-primary tracking-widest"
                    >
                      + 点击添加提醒
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats - Minimalist */}
            <div className="flex gap-4 px-2">
              <div className="flex-1">
                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">STREAK</p>
                <p className="text-xl font-black tracking-tighter">{streakCount} DAYS</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">COMPLETED</p>
                <p className="text-xl font-black tracking-tighter">{todaySchedule.filter(i => i.isCompleted).length}/{todaySchedule.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* View: Tasks Management */}
        {view === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter">提醒管理</h2>
              <span className="text-[10px] font-black text-gray-300 uppercase">{tasks.length} 项任务</span>
            </div>
            {tasks.map(task => (
              <motion.div 
                layout
                key={task.id}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center justify-between group"
              >
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                    task.type === 'MED' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                  )}>
                    {task.type === 'MED' ? <Pill size={24} /> : task.type === 'WATER' ? <Droplets size={24} /> : <Zap size={24} />}
                  </div>
                  <div>
                    <h3 className="font-black text-xl leading-none mb-1 uppercase">{task.name}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {task.reminders.map(r => r.time).join(', ')} • {task.dosage} • {task.frequency}次/日
                    </p>
                    {task.reminders.some(r => r.mealRelation !== 'NONE') && (
                      <p className="text-[8px] font-black text-gray-300 uppercase mt-1">
                        {task.reminders.filter(r => r.mealRelation !== 'NONE').map(r => r.mealRelation.replace('_', ' ')).join(' | ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { 
                      setEditingTask(task); 
                      setTaskForm(task); 
                      setSelectedCategory(null);
                      setIsAdding(true); 
                    }}
                    className="p-2 text-gray-200 hover:text-primary transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                    className="p-2 text-gray-200 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* View: History / Calendar */}
        {view === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase text-sm tracking-widest">
                  {format(currentMonth, 'yyyy年 MM月', { locale: zhCN })}
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <span key={d} className="text-[10px] font-black text-gray-300 uppercase">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const hasLogs = logs.some(l => isSameDay(new Date(l.timestamp), day));
                  return (
                    <button
                      key={day.toString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                        isSelected ? "bg-primary text-white shadow-lg" : "hover:bg-gray-50",
                        !isCurrentMonth && !isSelected && "opacity-20"
                      )}
                    >
                      <span className={cn("text-xs font-bold", isToday(day) && !isSelected && "text-red-500")}>{format(day, 'd')}</span>
                      {hasLogs && <div className={cn("w-1 h-1 rounded-full absolute bottom-1.5", isSelected ? "bg-white" : "bg-primary")} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{format(selectedDate, 'MM月dd日', { locale: zhCN })} 的记录</h4>
                <span className="text-[10px] font-black text-gray-300">{logsForSelectedDate.length} 条</span>
              </div>
              {logsForSelectedDate.map(log => (
                <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", log.status === 'taken' ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500")}>
                      {log.status === 'taken' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm">{log.taskName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{format(log.timestamp, 'HH:mm')} • {log.dosage}</p>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", log.status === 'taken' ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                    {log.status === 'taken' ? '已完成' : '未完成'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View: Health Management (Tips & Meal Times) */}
        {view === 'health' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter">健康管理</h2>
            
            {/* Health Tips Section */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">健康建议</h3>
              {(() => {
                const activeCategories = Array.from(new Set(tasks.filter(t => t.type === 'MED' && t.category).map(t => t.category!))) as string[];
                if (activeCategories.length === 0) {
                  return (
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 text-center">
                      <p className="text-gray-400 text-xs font-bold uppercase">暂无健康建议，请先添加药品</p>
                    </div>
                  );
                }
                return activeCategories.map(cat => {
                  const tips = HEALTH_TIPS[cat];
                  if (!tips) return null;
                  return (
                    <div key={cat} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tips.icon}</span>
                        <h4 className="text-lg font-black uppercase tracking-tight">{cat}</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">{tips.avoidTitle}</p>
                          <div className="flex flex-wrap gap-2">
                            {tips.avoid.map((item, idx) => (
                              <span key={idx} className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg">{item}</span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-green-500 uppercase tracking-wider">{tips.suggestTitle}</p>
                          <div className="flex flex-wrap gap-2">
                            {tips.suggest.map((item, idx) => (
                              <span key={idx} className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg">{item}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-8 border-t border-gray-100">
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-full bg-red-50 text-red-500 font-black py-5 rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-xs"
              >
                清空所有记录
              </button>
            </div>
          </div>
        )}
      </main>

      {/* --- Tab Bar --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-4 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button onClick={() => setView('dashboard')} className={cn("p-3 rounded-2xl transition-all", view === 'dashboard' ? "bg-primary text-white shadow-xl" : "text-gray-300")}>
            <LayoutDashboard size={24} />
          </button>
          <button onClick={() => setView('tasks')} className={cn("p-3 rounded-2xl transition-all", view === 'tasks' ? "bg-primary text-white shadow-xl" : "text-gray-300")}>
            <Pill size={24} />
          </button>
          <button onClick={() => setView('history')} className={cn("p-3 rounded-2xl transition-all", view === 'history' ? "bg-primary text-white shadow-xl" : "text-gray-300")}>
            <CalendarDays size={24} />
          </button>
          <button onClick={() => setView('health')} className={cn("p-3 rounded-2xl transition-all", view === 'health' ? "bg-primary text-white shadow-xl" : "text-gray-300")}>
            <Heart size={24} />
          </button>
        </div>
      </nav>

      {/* --- Modals --- */}

      {/* --- Clear History Confirmation Modal --- */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl space-y-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tighter">清空所有数据？</h3>
                <p className="text-gray-400 font-bold text-sm leading-relaxed">
                  确定要清空所有数据吗？此操作将删除所有药品、任务及历史记录，且不可撤销。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="bg-gray-100 text-gray-400 font-black py-5 rounded-2xl uppercase tracking-widest text-xs"
                >
                  取消
                </button>
                <button 
                  onClick={clearHistory}
                  className="bg-red-500 text-white font-black py-5 rounded-2xl shadow-lg shadow-red-200 uppercase tracking-widest text-xs"
                >
                  确定清空
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Task Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-primary/20 backdrop-blur-md" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-[48px] sm:rounded-[48px] p-10 relative shadow-2xl border-t border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 sm:hidden" />
              <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter">{editingTask ? `编辑${itemLabel}` : `添加${itemLabel}`}</h2>
              
              <div className="space-y-8">
                {/* Type Selector */}
                <div className="flex gap-2">
                  {(['MED', 'SUPP', 'WATER', 'EXERCISE'] as TaskType[]).map(t => (
                    <button 
                      key={t}
                      onClick={() => {
                        setTaskForm({...taskForm, type: t});
                        if (t !== 'MED') setEntryMode('MANUAL');
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        taskForm.type === t ? "bg-primary text-white shadow-lg" : "bg-gray-50 text-gray-400"
                      )}
                    >
                      {t === 'MED' ? '药品' : t === 'SUPP' ? '补品' : t === 'WATER' ? '喝水' : '运动/学习'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{itemLabel}名称</label>
                    {taskForm.type === 'MED' && (
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                          onClick={() => setEntryMode('SELECT')}
                          className={cn(
                            "px-3 py-1 text-[8px] font-black uppercase rounded-md transition-all",
                            entryMode === 'SELECT' ? "bg-white text-primary shadow-sm" : "text-gray-400"
                          )}
                        >
                          快捷选择
                        </button>
                        <button 
                          onClick={() => setEntryMode('MANUAL')}
                          className={cn(
                            "px-3 py-1 text-[8px] font-black uppercase rounded-md transition-all",
                            entryMode === 'MANUAL' ? "bg-white text-primary shadow-sm" : "text-gray-400"
                          )}
                        >
                          手动输入
                        </button>
                      </div>
                    )}
                  </div>

                  {entryMode === 'SELECT' && taskForm.type === 'MED' ? (
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {!selectedCategory ? (
                        <div className="grid grid-cols-1 gap-2">
                          {COMMON_MEDS.map((cat, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => setSelectedCategory(cat.category)}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between hover:bg-white hover:border-primary/20 transition-all group"
                            >
                              <span className="text-xs font-black uppercase tracking-widest text-gray-600 group-hover:text-primary">{cat.category}</span>
                              <ChevronRight size={14} className="text-gray-300 group-hover:text-primary" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <button 
                            onClick={() => setSelectedCategory(null)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase text-primary/40 hover:text-primary transition-colors"
                          >
                            <ChevronLeft size={12} />
                            返回病症列表
                          </button>
                          <div className="space-y-2">
                            <p className="text-[8px] font-black text-primary/40 uppercase tracking-widest">{selectedCategory}</p>
                            <div className="flex flex-wrap gap-2">
                              {COMMON_MEDS.find(c => c.category === selectedCategory)?.items.map((item, iIdx) => (
                                <button
                                  key={iIdx}
                                  onClick={() => setTaskForm({...taskForm, name: item, category: selectedCategory || undefined})}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                                    taskForm.name === item 
                                      ? "bg-primary border-primary text-white shadow-md" 
                                      : "bg-white border-gray-100 text-gray-600 hover:border-primary/30"
                                  )}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder={taskForm.type === 'WATER' ? '喝水' : taskForm.type === 'EXERCISE' ? '运动/学习' : '例如: 阿司匹林'} 
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-5 font-bold focus:border-primary focus:bg-white outline-none transition-all" 
                      value={taskForm.name} 
                      onChange={e => setTaskForm({...taskForm, name: e.target.value})} 
                    />
                  )}
                </div>

                {taskForm.type !== 'WATER' && taskForm.type !== 'EXERCISE' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">剂量 / 目标</label>
                      <input type="text" placeholder="例如: 1片" className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-5 font-bold focus:border-primary focus:bg-white outline-none transition-all" value={taskForm.dosage} onChange={e => setTaskForm({...taskForm, dosage: e.target.value})} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">每日次数</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(f => (
                          <button 
                            key={f}
                            onClick={() => {
                              const newReminders = [...(taskForm.reminders || [])];
                              if (f > newReminders.length) {
                                for (let i = newReminders.length; i < f; i++) {
                                  newReminders.push({ time: '08:00', mealRelation: 'NONE' });
                                }
                              } else {
                                newReminders.splice(f);
                              }
                              setTaskForm({...taskForm, frequency: f, reminders: newReminders});
                            }}
                            className={cn(
                              "flex-1 py-3 rounded-xl text-sm font-black transition-all",
                              taskForm.frequency === f ? "bg-primary text-white shadow-md" : "bg-gray-50 text-gray-400"
                            )}
                          >
                            {f}次
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {taskForm.type === 'WATER' && (
                  <div className="space-y-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">间隔提醒模式</label>
                      <button 
                        onClick={() => setTaskForm({...taskForm, isInterval: !taskForm.isInterval})}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          taskForm.isInterval ? "bg-primary" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          taskForm.isInterval ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>

                    {taskForm.isInterval && (
                      <div className="space-y-6 pt-4 border-t border-blue-100">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">提醒间隔 (小时)</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4].map(h => (
                              <button 
                                key={h}
                                onClick={() => setTaskForm({...taskForm, intervalHours: h})}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-sm font-black transition-all",
                                  taskForm.intervalHours === h ? "bg-primary text-white shadow-md" : "bg-white text-gray-400 border border-gray-100"
                                )}
                              >
                                {h}h
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">开始时间</label>
                            <input 
                              type="time" 
                              className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-primary"
                              value={taskForm.startTime}
                              onChange={e => setTaskForm({...taskForm, startTime: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">结束时间</label>
                            <input 
                              type="time" 
                              className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-primary"
                              value={taskForm.endTime}
                              onChange={e => setTaskForm({...taskForm, endTime: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">
                    {taskForm.isInterval && taskForm.type === 'WATER' ? '自定义提醒' : '时间设置'}
                  </label>
                  {!taskForm.isInterval && (taskForm.reminders || []).map((reminder, idx) => (
                    <div key={idx} className="bg-gray-50 p-5 rounded-2xl space-y-4 border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                          {taskForm.type === 'WATER' || taskForm.type === 'EXERCISE' ? '提醒时间' : `第 ${idx + 1} 次提醒`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {taskForm.type !== 'WATER' && taskForm.type !== 'EXERCISE' && (
                          <select 
                            className="bg-white border-2 border-transparent rounded-xl p-4 text-sm font-bold focus:border-primary outline-none appearance-none shadow-sm"
                            value={reminder.mealRelation}
                            onChange={e => {
                              const newReminders = [...(taskForm.reminders || [])];
                              newReminders[idx] = { ...newReminders[idx], mealRelation: e.target.value as MealRelation };
                              setTaskForm({...taskForm, reminders: newReminders});
                            }}
                          >
                            <option value="NONE">固定时间</option>
                            <option value="BEFORE_BREAKFAST">早餐前</option>
                            <option value="AFTER_BREAKFAST">早餐后</option>
                            <option value="BEFORE_LUNCH">午餐前</option>
                            <option value="AFTER_LUNCH">午餐后</option>
                            <option value="BEFORE_DINNER">晚餐前</option>
                            <option value="AFTER_DINNER">晚餐后</option>
                          </select>
                        )}
                        {reminder.mealRelation === 'NONE' || taskForm.type === 'WATER' || taskForm.type === 'EXERCISE' ? (
                          <input 
                            type="time" 
                            className={cn(
                              "bg-white border-2 border-transparent rounded-xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm",
                              (taskForm.type === 'WATER' || taskForm.type === 'EXERCISE') && "col-span-2"
                            )}
                            value={reminder.time}
                            onChange={e => {
                              const newReminders = [...(taskForm.reminders || [])];
                              newReminders[idx] = { ...newReminders[idx], time: e.target.value };
                              setTaskForm({...taskForm, reminders: newReminders});
                            }}
                          />
                        ) : (
                          <div className="bg-white rounded-xl p-4 text-sm font-bold flex items-center justify-between shadow-sm">
                            <span>{calculateTaskTime(reminder.mealRelation, mealSettings)}</span>
                            <Clock size={16} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {taskForm.type !== 'WATER' && taskForm.type !== 'EXERCISE' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">备注信息</label>
                      <textarea 
                        placeholder="例如: 饭后半小时服用，避免辛辣" 
                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-5 font-bold focus:border-primary focus:bg-white outline-none transition-all min-h-[100px]" 
                        value={taskForm.notes} 
                        onChange={e => setTaskForm({...taskForm, notes: e.target.value})} 
                      />
                    </div>

                    {/* Photo Upload Simulation */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">{itemLabel}照片</label>
                      <div className="flex gap-4">
                        <label className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-all">
                          <Camera size={24} className="text-gray-300 mb-2" />
                          <span className="text-[10px] font-black uppercase text-gray-400">上传照片</span>
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        {taskForm.photo && (
                          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary">
                            <img src={taskForm.photo} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Voice Selection */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">提醒语音</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTaskForm({...taskForm, voiceType: 'SYSTEM'})}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        taskForm.voiceType === 'SYSTEM' ? "bg-primary text-white shadow-lg" : "bg-gray-50 text-gray-400"
                      )}
                    >
                      系统语音
                    </button>
                    <button 
                      onClick={() => setTaskForm({...taskForm, voiceType: 'CUSTOM'})}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        taskForm.voiceType === 'CUSTOM' ? "bg-primary text-white shadow-lg" : "bg-gray-50 text-gray-400"
                      )}
                    >
                      自定义录音
                    </button>
                  </div>

                  {taskForm.voiceType === 'CUSTOM' && (
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                      {!isRecording ? (
                        <button 
                          onClick={startRecording}
                          className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                        >
                          <Mic size={20} />
                        </button>
                      ) : (
                        <button 
                          onClick={stopRecording}
                          className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg animate-pulse"
                        >
                          <div className="w-3 h-3 bg-red-500 rounded-sm" />
                        </button>
                      )}
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {isRecording ? '正在录音...' : taskForm.customVoice ? '已录制' : '点击开始录音'}
                        </p>
                      </div>
                      {taskForm.customVoice && !isRecording && (
                        <button 
                          onClick={playRecording}
                          className="w-10 h-10 bg-white text-primary rounded-xl flex items-center justify-center shadow-sm border border-gray-100"
                        >
                          <Volume2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={saveTask} className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl hover:bg-primary/90 active:scale-95 transition-all uppercase tracking-widest text-sm">
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-screen Reminder Modal */}
      <AnimatePresence>
        {activeReminder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-primary/90 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, rotate: -5 }} 
              animate={{ scale: 1, opacity: 1, rotate: 0 }} 
              exit={{ scale: 0.8, opacity: 0 }} 
              className="bg-white w-full max-w-sm rounded-[64px] p-12 relative shadow-2xl text-center border border-gray-100"
            >
              <div className={cn(
                "w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce",
                activeReminder.type === 'MED' ? "bg-red-500 text-white shadow-red-200" : "bg-blue-500 text-white shadow-blue-200"
              )}>
                {activeReminder.type === 'MED' ? <Bell size={48} /> : activeReminder.type === 'WATER' ? <Droplets size={48} /> : <Zap size={48} />}
              </div>
              
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-300 mb-2">
                {activeReminder.type === 'MED' ? '药品提醒' : activeReminder.type === 'SUPP' ? '补品提醒' : activeReminder.type === 'WATER' ? '喝水提醒' : '运动/学习提醒'}
              </p>
              <h2 className="text-4xl font-black mb-3 uppercase tracking-tighter">{activeReminder.name}</h2>
              <p className="text-gray-400 font-bold mb-10 uppercase tracking-tight">
                剂量 / 目标: <span className="text-primary">{activeReminder.dosage}</span>
              </p>

              {activeReminder.photo && (
                <div className="w-full aspect-video rounded-3xl overflow-hidden mb-8 border-2 border-gray-50">
                  <img src={activeReminder.photo} alt="Medication" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <button onClick={() => handleConfirm('taken')} className="bg-primary text-white font-black py-6 rounded-3xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                  ✅ 已完成
                </button>
                <button onClick={() => handleConfirm('missed')} className="bg-gray-50 text-gray-400 font-black py-4 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest text-[10px]">
                  ❌ 未完成
                </button>
              </div>
              
              <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-gray-300 flex items-center justify-center gap-2">
                <AlertCircle size={14} />
                {activeReminder.type === 'MED' ? '药品为强提醒，未确认将每5分钟重复' : '普通提醒，可轻量确认'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
