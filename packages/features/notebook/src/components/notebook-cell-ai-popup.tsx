'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { ArrowUp, AlertCircle } from 'lucide-react';

import { Button } from '@qwery/ui/button';
import { Textarea } from '@qwery/ui/textarea';
import { Alert, AlertDescription } from '@qwery/ui/alert';
import { cn } from '@qwery/ui/utils';

interface NotebookCellAiPopupProps {
    cellId: number;
    isQueryCell: boolean;
    isOpen: boolean;
    aiQuestion: string;
    setAiQuestion: Dispatch<SetStateAction<string>>;
    aiInputRef: RefObject<HTMLTextAreaElement | null>;
    cellContainerRef: RefObject<HTMLDivElement | null>;
    codeMirrorRef: RefObject<HTMLDivElement | null>;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    editorContainerRef: RefObject<HTMLDivElement | null>;
    activeAiPopup: { cellId: number; position: { x: number; y: number } } | null;
    onOpenAiPopup: (
        cellId: number,
        position: { x: number; y: number },
    ) => void;
    onCloseAiPopup: () => void;
    onSubmit: (e: React.FormEvent) => void;
    query: string;
    selectedDatasource: string | null;
    onRunQueryWithAgent?: (query: string, datasourceId: string) => void;
    isLoading?: boolean;
    enableShortcut?: boolean;
}

export function NotebookCellAiPopup({
    cellId,
    isQueryCell,
    isOpen,
    aiQuestion,
    setAiQuestion,
    aiInputRef,
    cellContainerRef,
    codeMirrorRef,
    textareaRef,
    editorContainerRef,
    activeAiPopup,
    onOpenAiPopup,
    onCloseAiPopup,
    onSubmit,
    query,
    selectedDatasource,
    onRunQueryWithAgent,
    isLoading = false,
    enableShortcut = true,
}: NotebookCellAiPopupProps) {
    const [showDatasourceError, setShowDatasourceError] = useState(false);
    const shortcutEnabled = enableShortcut && isQueryCell;

    const computePopupPosition = useCallback(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        const container = cellContainerRef.current;
        if (!container) {
            return null;
        }

        const margin = 16;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const popupWidth = Math.max(460, Math.min(640, viewportWidth - margin * 4));
        const popupHeight = Math.min(300, viewportHeight - margin * 2);

        const selection = window.getSelection();
        const hasValidRect = (rect: DOMRect) =>
            rect.width > 0 || rect.height > 0 || (rect.left >= 0 && rect.top >= 0);

        const getAnchorRect = (): DOMRect => {
            if (selection && selection.rangeCount > 0) {
                try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (hasValidRect(rect)) {
                        return rect;
                    }
                } catch {
                    // ignore selection errors
                }
            }

            if (isQueryCell) {
                const cmEditor = container.querySelector(
                    '.cm-editor',
                ) as HTMLElement | null;
                if (cmEditor) {
                    return cmEditor.getBoundingClientRect();
                }
            }

            if (textareaRef.current) {
                return textareaRef.current.getBoundingClientRect();
            }

            if (editorContainerRef.current) {
                return editorContainerRef.current.getBoundingClientRect();
            }

            return container.getBoundingClientRect();
        };

        let anchorRect = getAnchorRect();
        const containerRect = container.getBoundingClientRect();

        if (
            (anchorRect.width === 0 && anchorRect.height === 0) ||
            (anchorRect.left === 0 && anchorRect.top === 0)
        ) {
            anchorRect = containerRect;
        }
        const anchorMidY = anchorRect.top + anchorRect.height / 2;
        const maxTop = viewportHeight - popupHeight - margin;
        const top = Math.max(
            margin,
            Math.min(maxTop, anchorMidY - popupHeight / 2),
        );

        const maxLeft = viewportWidth - popupWidth - margin;
        let left = anchorRect.right + margin;
        if (left > maxLeft) {
            left = anchorRect.left - popupWidth - margin;
        }
        left = Math.max(margin, Math.min(maxLeft, left));

        return { x: left, y: top };
    }, [cellContainerRef, codeMirrorRef, editorContainerRef, isQueryCell, textareaRef]);

    useEffect(() => {
        if (!shortcutEnabled) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isQueryCell) {
                return;
            }
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isModKeyPressed = isMac ? event.metaKey : event.ctrlKey;
            if (!isModKeyPressed || event.key !== 'k') return;

            const container = cellContainerRef.current;
            const target = event.target as HTMLElement | null;
            if (!container || !target || !container.contains(target)) return;

            const isInputFocused =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                target.closest('.cm-editor') !== null;

            if (!isInputFocused) return;

            event.preventDefault();
            const position = computePopupPosition();
            if (position) {
                onOpenAiPopup(cellId, position);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        cellContainerRef,
        cellId,
        computePopupPosition,
        isQueryCell,
        onOpenAiPopup,
        shortcutEnabled,
    ]);

    useEffect(() => {
        if (!isOpen || !isQueryCell || !shortcutEnabled) {
            setAiQuestion('');
            setShowDatasourceError(false);
            return;
        }

        // Clear error when datasource is selected
        if (selectedDatasource && showDatasourceError) {
            setShowDatasourceError(false);
        }

        const focusTimeout = setTimeout(() => aiInputRef.current?.focus(), 0);

        const position = computePopupPosition();
        if (position) {
            onOpenAiPopup(cellId, position);
        }

        const handleViewportChange = () => {
            onCloseAiPopup();
        };

        window.addEventListener('scroll', handleViewportChange, true);
        window.addEventListener('resize', handleViewportChange);

        return () => {
            clearTimeout(focusTimeout);
            window.removeEventListener('scroll', handleViewportChange, true);
            window.removeEventListener('resize', handleViewportChange);
        };
    }, [
        aiInputRef,
        cellId,
        computePopupPosition,
        isOpen,
        isQueryCell,
        onCloseAiPopup,
        onOpenAiPopup,
        setAiQuestion,
        selectedDatasource,
        showDatasourceError,
        shortcutEnabled,
    ]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCloseAiPopup();
                setAiQuestion('');
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (
                !target.closest('[data-ai-popup]') &&
                (!cellContainerRef.current ||
                    !cellContainerRef.current.contains(target))
            ) {
                onCloseAiPopup();
                setAiQuestion('');
            }
        };

        window.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [cellContainerRef, isOpen, onCloseAiPopup, setAiQuestion]);

    const popupPosition =
        isOpen && activeAiPopup?.cellId === cellId
            ? activeAiPopup.position
            : undefined;

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            className={cn(
                'fixed z-10000 pointer-events-none transition-opacity duration-150',
                isOpen ? 'opacity-100' : 'opacity-0',
            )}
            style={
                popupPosition
                    ? {
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y}px`,
                    }
                    : { opacity: 0 }
            }
        >
            <div
                data-ai-popup
                className={cn(
                    'pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl px-5 py-5 min-w-[460px] w-[min(640px,calc(100vw-64px))] max-w-[720px] relative transition-all duration-150',
                    isOpen
                        ? 'animate-in fade-in-0 zoom-in-90'
                        : 'animate-out fade-out-0 zoom-out-90',
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition"
                    onClick={() => {
                        onCloseAiPopup();
                        setAiQuestion('');
                    }}
                    aria-label="Close AI prompt"
                >
                    ×
                </button>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!aiQuestion.trim() || !onRunQueryWithAgent || isLoading) return;

                        if (!selectedDatasource) {
                            setShowDatasourceError(true);
                            return;
                        }

                        setShowDatasourceError(false);
                        onRunQueryWithAgent(query, selectedDatasource);

                        if (!isLoading) {
                            setAiQuestion('');
                        }
                    }}
                    className="relative w-full pt-4"
                >
                    {showDatasourceError && !selectedDatasource && (
                        <Alert variant="destructive" className="flex items-center gap-2 mb-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Please select a datasource first before sending an AI query.
                            </AlertDescription>
                        </Alert>
                    )}
                    <Textarea
                        ref={aiInputRef}
                        value={aiQuestion}
                        onChange={(e) => {
                            setAiQuestion(e.target.value);
                            // Clear error when user starts typing
                            if (showDatasourceError) {
                                setShowDatasourceError(false);
                            }
                        }}
                        placeholder="Ask the AI agent anything about this cell..."
                        className="w-full min-h-[120px] max-h-[260px] rounded-2xl border border-border bg-background/80 py-3 pl-4 pr-16 text-base shadow-inner focus-visible:ring-2 resize-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50"
                        autoFocus
                        disabled={isLoading}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg"
                        disabled={!aiQuestion.trim() || isLoading}
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <ArrowUp className="h-4 w-4" />
                        )}
                    </Button>
                </form>
            </div>
        </div>,
        document.body,
    );
}

