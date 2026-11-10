'use client';

import type { UierProject } from './projects';
import {
    getReviewActivation,
    reviewSessionKey,
    reviewToggleUrl,
} from './reviewState';

let activeProject: UierProject | undefined;
let snapshot = 'unavailable';
const listeners = new Set<() => void>();

function read(key: string) {
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key: string, value: string | null) {
    try {
        if (value === null) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, value);
    } catch {
        // Explicit URL activation still works when storage is unavailable.
    }
}

function notify() {
    for (const listener of listeners) listener();
}

function refreshExitState() {
    if (
        activeProject &&
        snapshot === 'enabled' &&
        read('gredice:uier:owner') === activeProject &&
        read('uier:review-exited') === '1'
    ) {
        snapshot = 'disabled';
        write(reviewSessionKey(activeProject), '0');
        notify();
    }
}

function afterToolbarInteraction() {
    queueMicrotask(refreshExitState);
}

export function subscribeToReview(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
        window.addEventListener('click', afterToolbarInteraction);
        window.addEventListener('focus', refreshExitState);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            window.removeEventListener('click', afterToolbarInteraction);
            window.removeEventListener('focus', refreshExitState);
        }
    };
}

export function reviewSnapshot() {
    return snapshot;
}

export function serverReviewSnapshot() {
    return 'unavailable';
}

export function prepareReview(project: UierProject, projectCode: string) {
    let search = window.location.search;
    if (project === 'storybook' && window.parent !== window) {
        try {
            if (
                getReviewActivation(window.parent.location.search, null, false)
                    .explicit
            ) {
                search = window.parent.location.search;
                const params = new URLSearchParams(search);
                const canvasUrl = new URL(window.location.href);
                for (const key of [
                    'review',
                    'toolbar-code',
                    'uier-token',
                    'uier-check',
                ]) {
                    const value = params.get(key);
                    if (value !== null) canvasUrl.searchParams.set(key, value);
                }
                window.history.replaceState(
                    window.history.state,
                    '',
                    canvasUrl,
                );
                // Consume the manager's one-time launch parameters. Keeping
                // them there would re-enable review when switching stories
                // after the reviewer has used UIer's Exit control.
                const managerUrl = new URL(window.parent.location.href);
                for (const key of [
                    'review',
                    'toolbar-code',
                    'uier-token',
                    'uier-check',
                ]) {
                    managerUrl.searchParams.delete(key);
                }
                window.parent.history.replaceState(
                    window.parent.history.state,
                    '',
                    managerUrl,
                );
            }
        } catch {
            // A separately hosted canvas can still use its own review link.
        }
    }

    const activation = getReviewActivation(
        search,
        read(reviewSessionKey(project)),
        read('gredice:uier:owner') === project &&
            read('uier:review-exited') === '1',
    );
    activeProject = project;
    snapshot = activation.enabled ? 'enabled' : 'disabled';
    notify();

    if (activation.explicit) {
        write(reviewSessionKey(project), activation.enabled ? '1' : '0');
    }
    if (!activation.enabled || !projectCode) return false;

    // UIer's legacy session is origin-wide. Reset it before switching between
    // WWW and News so a review cannot silently target the other app's project.
    if (read('gredice:uier:owner') !== project || activation.explicit) {
        write('uier:review', null);
        write('uier:review-exited', null);
    }
    write('gredice:uier:owner', project);

    // Restore this app's explicit opt-in on full-page navigation, including
    // Storybook's canvas iframe, without adding review links to normal URLs.
    if (!new URLSearchParams(window.location.search).get('toolbar-code')) {
        write('uier:review', JSON.stringify({ projectCode }));
    }

    return true;
}

export function toggleReview(enabled: boolean) {
    if (!activeProject) return;
    write(reviewSessionKey(activeProject), enabled ? '1' : '0');
    write('uier:review', null);
    write('uier:review-exited', enabled ? null : '1');
    // Reload to fully remove vendor event handlers and any captured page state
    // when disabling, rather than merely hiding the toolbar element.
    window.location.assign(reviewToggleUrl(window.location.href, enabled));
}

/** End app feedback after logout, replacing a document that loaded UIer. */
export function endUierReviewSession(
    project: UierProject,
    { navigate = true }: { navigate?: boolean } = {},
) {
    const shouldReload =
        activeProject === project &&
        document.getElementById('gredice-uier-review') !== null;

    write(reviewSessionKey(project), '0');
    if (read('gredice:uier:owner') === project) {
        write('gredice:uier:owner', null);
        write('uier:review', null);
        write('uier:review-exited', '1');
    }
    if (activeProject === project) {
        snapshot = 'disabled';
        notify();
    }

    if (shouldReload && navigate) {
        window.location.assign(reviewToggleUrl(window.location.href, false));
    }
    return shouldReload;
}
