import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  AlertCircle,
  X,
  FileText,
  MapPin,
  CheckCircle2,
  FileUp,
  FolderInput,
  Sparkles
} from 'lucide-react';
import { Zone } from '../types';
import { createZoneExportPayload, downloadJsonFile, parseAndValidateZonesJson } from '../utils';

interface ZoneBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: Zone[];
  onImportZones: (importedZones: Zone[], mode: 'merge' | 'replace') => void;
  initialTab?: 'export' | 'import';
}

export default function ZoneBackupModal({
  isOpen,
  onClose,
  zones,
  onImportZones,
  initialTab = 'export',
}: ZoneBackupModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [copied, setCopied] = useState(false);

  // Import states
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedPreview, setParsedPreview] = useState<{ zones: Zone[]; totalParsed: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isManualPasteOpen, setIsManualPasteOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const exportPayload = createZoneExportPayload(zones);
  const formattedJsonString = JSON.stringify(exportPayload, null, 2);

  const handleDownload = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `silent_zones_backup_${timestamp}.json`;
    downloadJsonFile(filename, exportPayload);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API restricted in iframe
      const textarea = document.createElement('textarea');
      textarea.value = formattedJsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const processJsonContent = (text: string, filename?: string) => {
    setValidationError(null);
    setSelectedFileName(filename || null);

    const result = parseAndValidateZonesJson(text);
    if (!result.success || !result.zones) {
      setParsedPreview(null);
      setValidationError(result.error || 'Failed to parse silent zones JSON.');
      return;
    }

    setParsedPreview({ zones: result.zones, totalParsed: result.totalParsed || result.zones.length });
    setValidationError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      processJsonContent(content, file.name);
    };
    reader.readAsText(file);
    // Reset file input so same file can be reselected if needed
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setImportText(content);
        processJsonContent(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setImportText(text);
    if (text.trim()) {
      processJsonContent(text, 'pasted-text.json');
    } else {
      setParsedPreview(null);
      setValidationError(null);
      setSelectedFileName(null);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.zones.length === 0) return;
    onImportZones(parsedPreview.zones, importMode);
    onClose();
  };

  return (
    <div
      id="zone-backup-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <FileCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight">Zone Backup & JSON</h3>
              <p className="text-[11px] text-slate-500 font-medium">Export and import saved silent locations</p>
            </div>
          </div>
          <button
            id="close-backup-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 bg-white">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              id="tab-export-json-btn"
              onClick={() => setActiveTab('export')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download size={14} />
              Export JSON ({zones.length})
            </button>
            <button
              id="tab-import-json-btn"
              onClick={() => setActiveTab('import')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={14} />
              Import JSON
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === 'export' ? (
              <motion.div
                key="tab-export"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
                className="space-y-3.5"
              >
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5">
                    <Download size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-800">
                      {zones.length} Silent {zones.length === 1 ? 'Location' : 'Locations'} Configured
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Download a standalone JSON backup file or copy the raw JSON payload to restore later.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    id="export-download-json-btn"
                    onClick={handleDownload}
                    disabled={zones.length === 0}
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <Download size={14} />
                    Download .JSON
                  </button>

                  <button
                    id="export-copy-json-btn"
                    onClick={handleCopy}
                    disabled={zones.length === 0}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-bold text-xs border border-slate-200/80 transition flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copy JSON
                      </>
                    )}
                  </button>
                </div>

                {/* JSON Preview Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      JSON Preview
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {zones.length} {zones.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-[11px] font-mono max-h-56 overflow-y-auto border border-slate-800 shadow-inner select-text">
                    <pre className="whitespace-pre-wrap break-all leading-relaxed">
                      {formattedJsonString}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="tab-import"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Drag and drop upload target */}
                <div
                  id="json-file-dropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
                      : 'border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="hidden-json-file-input"
                  />
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                    <FileUp size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedFileName ? selectedFileName : 'Click to browse or drag & drop JSON'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Accepts exported backup files or custom zone arrays
                  </p>
                </div>

                {/* Toggle Manual Text Paste */}
                <div>
                  <button
                    id="toggle-paste-json-btn"
                    type="button"
                    onClick={() => setIsManualPasteOpen(!isManualPasteOpen)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                  >
                    <FileText size={13} />
                    {isManualPasteOpen ? 'Hide raw JSON paste' : 'Or paste JSON code directly'}
                  </button>

                  {isManualPasteOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2"
                    >
                      <textarea
                        id="import-raw-json-textarea"
                        value={importText}
                        onChange={handlePasteChange}
                        placeholder='Paste JSON here (e.g. { "zones": [...] } or [ { "name": "Library", "lat": 37.77, "lng": -122.41, "radius": 100 } ])'
                        rows={4}
                        className="w-full bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl p-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Validation Feedback */}
                {validationError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                    <div>
                      <p className="font-bold">Validation Error</p>
                      <p className="text-[11px] text-red-600 mt-0.5">{validationError}</p>
                    </div>
                  </div>
                )}

                {/* Parsed Preview Card */}
                {parsedPreview && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        Valid Backup: {parsedPreview.totalParsed} {parsedPreview.totalParsed === 1 ? 'Zone' : 'Zones'}
                      </span>
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        Ready to Import
                      </span>
                    </div>

                    {/* Zone Items Preview */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {parsedPreview.zones.map((zone, idx) => (
                        <div
                          key={zone.id || idx}
                          className="bg-white/90 border border-emerald-100 rounded-xl p-2 text-xs flex items-center justify-between shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin size={13} className="text-indigo-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">{zone.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono shrink-0">
                            {zone.radius}m • ({zone.lat.toFixed(3)}, {zone.lng.toFixed(3)})
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Import Strategy Selector */}
                    <div className="pt-2 border-t border-emerald-100/80">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Import Strategy
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          id="import-mode-merge-btn"
                          onClick={() => setImportMode('merge')}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            importMode === 'merge'
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-2xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Sparkles size={12} className="text-indigo-600" />
                            Merge ({zones.length} + {parsedPreview.totalParsed})
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Keep existing & append new</p>
                        </button>

                        <button
                          type="button"
                          id="import-mode-replace-btn"
                          onClick={() => setImportMode('replace')}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            importMode === 'replace'
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-2xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <p className="text-xs font-bold flex items-center gap-1">
                            <FolderInput size={12} className="text-indigo-600" />
                            Replace ({parsedPreview.totalParsed})
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Overwrite all current zones</p>
                        </button>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      id="confirm-import-zones-btn"
                      onClick={handleConfirmImport}
                      className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Check size={15} />
                      {importMode === 'merge'
                        ? `Merge ${parsedPreview.totalParsed} Zones into List`
                        : `Replace List with ${parsedPreview.totalParsed} Zones`}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            JSON format v1.0 • Standard coordinate geofencing
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 rounded-lg font-semibold transition"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
