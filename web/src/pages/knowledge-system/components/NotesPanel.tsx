
import { useEffect, useState } from 'react';
import { Modal } from 'antd';

interface Note {
  id: string;
  content: string;
  timestamp: string;
  tag: 'important' | 'question' | 'idea' | 'normal';
  resourceId?: string;
  resourceTitle?: string;
}

interface NotesPanelProps {
  knowledgeName: string;
  resourceId?: string;
  resourceTitle?: string;
  initialNotes?: Note[];
}

const NOTE_MAX_LENGTH = 50;

const tagConfig = {
  important: {
    label: '重点',
    color: 'bg-red-100 text-red-600',
    icon: 'ri-star-fill',
  },
  question: {
    label: '疑问',
    color: 'bg-yellow-100 text-yellow-600',
    icon: 'ri-question-line',
  },
  idea: {
    label: '想法',
    color: 'bg-green-100 text-green-600',
    icon: 'ri-lightbulb-line',
  },
  normal: {
    label: '笔记',
    color: 'bg-gray-100 text-gray-600',
    icon: 'ri-edit-line',
  },
};

const defaultInitialNotes: Note[] = [];

const getNotesStorageKey = (resourceId: string) => `learning_resource_notes_${resourceId}`;

const getInitialNotesForResource = (resourceId: string, initialNotes: Note[]) =>
  initialNotes.filter((note) => !note.resourceId || note.resourceId === resourceId);

const loadNotesForResource = (resourceId: string, initialNotes: Note[]) => {
  if (typeof window === 'undefined') return getInitialNotesForResource(resourceId, initialNotes);
  try {
    const stored = window.localStorage.getItem(getNotesStorageKey(resourceId));
    if (!stored) return getInitialNotesForResource(resourceId, initialNotes);
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Note[]) : getInitialNotesForResource(resourceId, initialNotes);
  } catch {
    return getInitialNotesForResource(resourceId, initialNotes);
  }
};

const saveNotesForResource = (resourceId: string, notes: Note[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getNotesStorageKey(resourceId), JSON.stringify(notes));
  } catch {
    return;
  }
};

const getNoteTime = (note: Note) => {
  const timestampTime = Date.parse(note.timestamp);
  if (!Number.isNaN(timestampTime)) return timestampTime;

  const idTime = Number(note.id.replace(/^n/, ''));
  return Number.isFinite(idTime) ? idTime : null;
};

const formatNoteTime = (note: Note, now: number) => {
  const noteTime = getNoteTime(note);
  if (!noteTime) return note.timestamp;

  const diffMinutes = Math.max(0, Math.floor((now - noteTime) / 60000));
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  const date = new Date(noteTime);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

export default function NotesPanel({
  knowledgeName,
  resourceId,
  resourceTitle,
  initialNotes = defaultInitialNotes,
}: NotesPanelProps) {
  const currentResourceId = resourceId || knowledgeName;
  const currentResourceTitle = resourceTitle || knowledgeName;
  const [notesByResource, setNotesByResource] = useState<Record<string, Note[]>>(() => ({
    [currentResourceId]: loadNotesForResource(currentResourceId, initialNotes),
  }));
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState<Note['tag']>('normal');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filterTag, setFilterTag] = useState<Note['tag'] | 'all'>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const notes = notesByResource[currentResourceId] || [];

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setNotesByResource((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, currentResourceId)) return prev;
      return {
        ...prev,
        [currentResourceId]: loadNotesForResource(currentResourceId, initialNotes),
      };
    });
    setShowAddNote(false);
    setNewNoteContent('');
    setNewNoteTag('normal');
    setEditingId(null);
    setEditContent('');
    setFilterTag('all');
  }, [currentResourceId, initialNotes]);

  const safeSetNotes = (updater: (prev: Note[]) => Note[]) => {
    const nextNotes = updater(notes);
    saveNotesForResource(currentResourceId, nextNotes);
    setNotesByResource((prev) => ({
      ...prev,
      [currentResourceId]: nextNotes,
    }));
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    const now = Date.now();
    const content = newNoteContent.trim().slice(0, NOTE_MAX_LENGTH);
    const note: Note = {
      id: `n${now}`,
      content,
      timestamp: new Date(now).toISOString(),
      tag: newNoteTag,
      resourceId: currentResourceId,
      resourceTitle: currentResourceTitle,
    };
    safeSetNotes((prev) => [note, ...prev]);
    setCurrentTime(now);
    setNewNoteContent('');
    setNewNoteTag('normal');
    setShowAddNote(false);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确认删除这条笔记吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        safeSetNotes((prev) => prev.filter((n) => n.id !== id));
      },
    });
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editContent.trim()) {
      return;
    }
    const now = Date.now();
    const content = editContent.trim().slice(0, NOTE_MAX_LENGTH);
    safeSetNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, content, timestamp: new Date(now).toISOString() } : n,
      ),
    );
    setCurrentTime(now);
    setEditingId(null);
  };

  const filtered =
    filterTag === 'all' ? notes : notes.filter((n) => n.tag === filterTag);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      style={{ height: '100%' }}
    >
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
            <i className="ri-sticky-note-line text-amber-500 text-lg"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">我的笔记</h3>
            <p className="text-xs text-gray-400">{notes.length} 条记录</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddNote(!showAddNote)}
          className="w-8 h-8 flex items-center justify-center bg-teal-500 hover:bg-teal-600 text-white rounded-full transition-all shadow-sm"
        >
          <i
            className={`${
              showAddNote ? 'ri-close-line' : 'ri-add-line'
            } text-sm`}
          ></i>
        </button>
      </div>

      {/* 新增笔记区域 */}
      {showAddNote && (
        <div className="px-1 py-1 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <div className="overflow-x-auto px-1 py-1 mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center space-x-2 w-max">
              {(Object.keys(tagConfig) as Note['tag'][]).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNewNoteTag(tag)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    newNoteTag === tag
                      ? `${tagConfig[tag].color} ring-1 ring-teal-400`
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  <i className={`${tagConfig[tag].icon} mr-1`}></i>
                  {tagConfig[tag].label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="记录你的想法、疑问或重点..."
            className="w-full text-sm border border-amber-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
          />
          <div className="flex items-center justify-end mt-2">
            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-xs text-gray-400">
                {newNoteContent.length}/{NOTE_MAX_LENGTH}
              </span>
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNoteContent.trim()}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs rounded-lg transition-all whitespace-nowrap"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 筛选标签 */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
        <button
          type="button"
          onClick={() => setFilterTag('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            filterTag === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部 ({notes.length})
        </button>
        {(Object.keys(tagConfig) as Note['tag'][]).map((tag) => {
          const count = notes.filter((n) => n.tag === tag).length;
          if (count === 0) return null;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                filterTag === tag
                  ? `${tagConfig[tag].color} ring-1 ring-current`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className={`${tagConfig[tag].icon} mr-1`}></i>
              {tagConfig[tag].label} ({count})
            </button>
          );
        })}
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <i className="ri-sticky-note-2-line text-2xl text-gray-400"></i>
            </div>
            <p className="text-sm text-gray-500">暂无笔记</p>
            <p className="text-xs text-gray-400 mt-1">点击右上角 + 开始记录</p>
          </div>
        ) : (
          filtered.map((note) => (
            <div key={note.id} className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all">
              {/* 标签和时间 */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium ${tagConfig[note.tag].color}`}
                >
                  <i className={`${tagConfig[note.tag].icon} mr-1`}></i>
                  {tagConfig[note.tag].label}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">{formatNoteTime(note, currentTime)}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(note)}
                      title="修改"
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-teal-600 transition-colors"
                    >
                      <i className="ri-edit-line text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      title="删除"
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <i className="ri-delete-bin-line text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* 笔记内容 */}
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-sm border border-teal-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all whitespace-nowrap"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(note.id)}
                      className="px-3 py-1 text-xs bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all whitespace-nowrap"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
              )}

              {/* 来源 */}
              {note.resourceTitle && (
                <p className="text-xs text-gray-400 mt-2 flex items-center">
                  <i className="ri-links-line mr-1"></i>
                  {note.resourceTitle}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
