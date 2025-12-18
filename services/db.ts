import { Question, Syllabus } from '../types';

const DB_NAME = 'AceAI_DB';
const DB_VERSION = 2;
const STORES = {
  QUESTIONS: 'questions',
  SYLLABUSES: 'syllabuses'
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
        const qStore = db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' });
        qStore.createIndex('tags', 'tags', { multiEntry: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.SYLLABUSES)) {
        db.createObjectStore(STORES.SYLLABUSES, { keyPath: 'id' });
      }
    };
  });
};

export const saveQuestion = async (question: Question): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.QUESTIONS, 'readwrite');
    const store = transaction.objectStore(STORES.QUESTIONS);
    const request = store.put(question);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveQuestions = async (questions: Question[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.QUESTIONS, 'readwrite');
    const store = transaction.objectStore(STORES.QUESTIONS);
    
    questions.forEach(q => store.put(q));
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveSyllabus = async (syllabus: Syllabus): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYLLABUSES, 'readwrite');
    const store = transaction.objectStore(STORES.SYLLABUSES);
    const request = store.put(syllabus);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllQuestions = async (): Promise<Question[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.QUESTIONS, 'readonly');
    const store = transaction.objectStore(STORES.QUESTIONS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllSyllabuses = async (): Promise<Syllabus[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYLLABUSES, 'readonly');
    const store = transaction.objectStore(STORES.SYLLABUSES);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const searchQuestionsByTag = async (tag: string): Promise<Question[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.QUESTIONS, 'readonly');
    const store = transaction.objectStore(STORES.QUESTIONS);
    const index = store.index('tags');
    const request = index.getAll(tag); // Exact match on one of the tags
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Helper to fuzzy search tags if needed, or just get all and filter
export const findRelevantQuestions = async (query: string): Promise<Question[]> => {
    const allQuestions = await getAllQuestions();
    // Simple filter: check if query is in tags or text
    return allQuestions.filter(q => 
        q.tags.some(t => t.toLowerCase().includes(query.toLowerCase())) ||
        q.text.toLowerCase().includes(query.toLowerCase())
    );
};

export const findRelevantSyllabuses = async (query: string): Promise<Syllabus[]> => {
  const allSyllabuses = await getAllSyllabuses();
  return allSyllabuses.filter(s => 
    s.courseName.toLowerCase().includes(query.toLowerCase()) ||
    s.modules.some(m => m.title.toLowerCase().includes(query.toLowerCase()) || m.keyPoints.some(k => k.toLowerCase().includes(query.toLowerCase())))
  );
};
