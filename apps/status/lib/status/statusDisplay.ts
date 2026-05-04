import type { StatusLevel } from './types';

export function getStatusLabel(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'Radi';
        case 'degraded':
            return 'Usporeno';
        case 'down':
            return 'Problem';
        case 'unknown':
            return 'Nepoznato';
    }
}

export function getOverallStatusMessage(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'Svi sustavi rade';
        case 'degraded':
            return 'Dio sustava je usporen';
        case 'down':
            return 'Prekid usluge';
        case 'unknown':
            return 'Status se učitava';
    }
}

export function getStatusDotClassName(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'bg-[#2e6f40]';
        case 'degraded':
            return 'bg-[#b7791f]';
        case 'down':
            return 'bg-[#c2412d]';
        case 'unknown':
            return 'bg-[#71776d]';
    }
}

export function getStatusPillClassName(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'border-[#2e6f40] bg-[#2e6f40] text-white';
        case 'degraded':
            return 'border-[#b7791f] bg-[#b7791f] text-white';
        case 'down':
            return 'border-[#c2412d] bg-[#c2412d] text-white';
        case 'unknown':
            return 'border-[#71776d] bg-[#71776d] text-white';
    }
}

export function getStatusBorderClassName(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'border-[#d9ded2]';
        case 'degraded':
            return 'border-[#e7c76d]';
        case 'down':
            return 'border-[#e0a596]';
        case 'unknown':
            return 'border-[#d0d5ca]';
    }
}

export function getStatusTextClassName(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'text-[#245b35]';
        case 'degraded':
            return 'text-[#7b4f10]';
        case 'down':
            return 'text-[#902c1d]';
        case 'unknown':
            return 'text-[#4d554a]';
    }
}

export function getHistoryDotClassName(status: StatusLevel) {
    switch (status) {
        case 'operational':
            return 'bg-[#2e6f40]';
        case 'degraded':
            return 'bg-[#b7791f]';
        case 'down':
            return 'bg-[#c2412d]';
        case 'unknown':
            return 'bg-[#c5cbc0]';
    }
}
