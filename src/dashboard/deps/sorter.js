/**
 * ScoreManager - Handles sorting, searching, and filtering of osu! scores
 * Implements better design patterns and separation of concerns
 */
class ScoreManager {
    static SORT_ORDER = {
        ASC: 'asc',
        DESC: 'desc'
    };

    static SORT_TYPES = {
        DEFAULT: 'default',
        TITLE: 'title',
        ARTIST: 'artist',
        USER: 'user',
        DATE: 'date',
        PP: 'pp',
        MAX_PP: 'maxPP',
        COMBO: 'combo',
        ACCURACY: 'acc',
        STAR_RATING: 'sr',
        BPM: 'bpm',
        CIRCLE_SIZE: 'cs',
        HP_DRAIN: 'hp',
        APPROACH_RATE: 'ar',
        OVERALL_DIFFICULTY: 'od'
    };

    static MOD_OPERATORS = {
        INCLUDE: '+',
        EXCLUDE: '-',
        EXACT: '*'
    };

    static COMPARISON_OPERATORS = ['>=', '<=', '>', '<', '='];

    static DEFAULT_VALUES = {
        ARTIST: 'Unknown Artist',
        SONG_TITLE: 'Unknown Song',
        PLAYER_NAME: 'Unknown Player',
        GUEST_NAME: 'Guest (Offline)'
    };

    static SVG_ICONS = {
        ASCENDING: `<svg fill="#fff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c-9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V456c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3 .4z"/></svg>`,
        DESCENDING: `<svg fill="#fff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3 .4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z"/></svg>`
    };

    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.currentScores = null;
    }

    initializeElements() {
        this.elements = {
            toggleSortButton: document.getElementById('toggle-sort'),
            sortSelector: document.getElementById('sort'),
            searchTextbox: document.getElementById('search'),
            userSearchInput: document.getElementById('search-user'),
            resetUserSearchButton: document.querySelector('.reset-checkbox'),
            resetCacheButton: document.getElementById('reset-cache')
        };

        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element not found: ${key}`);
            }
        });
    }

    attachEventListeners() {
        if (this.elements.toggleSortButton) {
            this.elements.toggleSortButton.addEventListener('click', () => this.handleSortOrderToggle());
        }

        if (this.elements.sortSelector) {
            this.elements.sortSelector.addEventListener('change', () => this.handleSortChange());
        }

        if (this.elements.searchTextbox) {
            this.elements.searchTextbox.addEventListener('input', () => this.handleSearch());
        }

        if (this.elements.userSearchInput) {
            this.elements.userSearchInput.addEventListener('input', () => this.handleUserSearch());
        }

        if (this.elements.resetUserSearchButton) {
            this.elements.resetUserSearchButton.addEventListener('click', () => this.handleResetUserSearch());
        }

        if (this.elements.resetCacheButton) {
            this.elements.resetCacheButton.addEventListener('click', () => this.handleResetCache());
        }
    }

    /**
     * Handle sort order toggle (ascending/descending)
     */
    handleSortOrderToggle() {
        const button = this.elements.toggleSortButton;
        const currentOrder = button.dataset.order || ScoreManager.SORT_ORDER.ASC;
        const newOrder = currentOrder === ScoreManager.SORT_ORDER.ASC 
            ? ScoreManager.SORT_ORDER.DESC 
            : ScoreManager.SORT_ORDER.ASC;

        button.dataset.order = newOrder;
        this.updateSortIcon(newOrder);

        if (this.hasValidScores()) {
            this.sortScores();
        }
    }

    /**
     * Update sort icon based on order
     */
    updateSortIcon(order) {
        const button = this.elements.toggleSortButton;
        button.innerHTML = order === ScoreManager.SORT_ORDER.ASC 
            ? ScoreManager.SVG_ICONS.ASCENDING 
            : ScoreManager.SVG_ICONS.DESCENDING;
    }

    /**
     * Handle sort type change
     */
    handleSortChange() {
        if (this.hasValidScores()) {
            this.sortScores();
        }
    }

    /**
     * Check if scores exist and are valid
     */
    hasValidScores() {
        return this.getScoresFromGlobal() !== null;
    }

    /**
     * Get scores from global variable (dependency injection would be better)
     */
    getScoresFromGlobal() {
        return typeof scores !== 'undefined' ? scores : null;
    }

    /**
     * Get scores from localStorage with fallback
     */
    getScoresFromStorage() {
        try {
            const storedScores = localStorage.getItem('scores');
            return storedScores ? JSON.parse(storedScores) : this.getScoresFromGlobal();
        } catch (error) {
            console.error('Error parsing scores from localStorage:', error);
            return this.getScoresFromGlobal();
        }
    }

    /**
     * Main sorting function with improved organization
     */
    sortScores() {
        const globalScores = this.getScoresFromGlobal();
        if (!globalScores) return;

        const sortType = this.elements.sortSelector?.value || ScoreManager.SORT_TYPES.DEFAULT;
        const sortOrder = this.elements.toggleSortButton?.dataset.order || ScoreManager.SORT_ORDER.ASC;
        
        // Get fresh scores from storage
        const scoresData = this.getScoresFromStorage();
        if (!scoresData) return;

        const sortedScores = this.applySorting(scoresData, sortType, sortOrder);
        
        // Update global scores
        if (typeof scores !== 'undefined') {
            scores = sortedScores;
        }

        // Reset pagination to first page
        if (typeof page !== 'undefined') {
            page = 0;
        }

        // Update dashboard if available
        if (window.dashboard && typeof window.dashboard.setScores === 'function') {
            window.dashboard.setScores(sortedScores);
            window.dashboard.setCurrentPage(0);
        } else {
            // Fallback: update pagination counter manually and trigger UI update
            if (typeof pageCounter !== 'undefined' && typeof elemPerPage !== 'undefined') {
                pageCounter.innerText = `${1}/${Math.ceil(sortedScores.length / elemPerPage) || 1}`;
            }
            
            if (typeof loadScores === 'function') {
                loadScores();
            }
        }
    }

    /**
     * Apply sorting based on type and order
     */
    applySorting(scoresArray, sortType, sortOrder) {
        let sortedScores = [...scoresArray]; 

        const compareFunctions = {
            [ScoreManager.SORT_TYPES.TITLE]: (a, b) => this.compareStrings(a.beatmap?.song_title, b.beatmap?.song_title),
            [ScoreManager.SORT_TYPES.ARTIST]: (a, b) => this.compareStrings(a.beatmap?.artist, b.beatmap?.artist),
            [ScoreManager.SORT_TYPES.USER]: (a, b) => this.compareStrings(a.playerName, b.playerName),
            [ScoreManager.SORT_TYPES.DATE]: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
            [ScoreManager.SORT_TYPES.PP]: (a, b) => (a.currentPP || 0) - (b.currentPP || 0),
            [ScoreManager.SORT_TYPES.MAX_PP]: (a, b) => (a.maxPP || 0) - (b.maxPP || 0),
            [ScoreManager.SORT_TYPES.COMBO]: (a, b) => (a.maxcombo || 0) - (b.maxcombo || 0),
            [ScoreManager.SORT_TYPES.ACCURACY]: (a, b) => this.calculateAccuracy(a) - this.calculateAccuracy(b),
            [ScoreManager.SORT_TYPES.STAR_RATING]: (a, b) => (a.star_rating || 0) - (b.star_rating || 0),
            [ScoreManager.SORT_TYPES.BPM]: (a, b) => (a.bpm || 0) - (b.bpm || 0),
            [ScoreManager.SORT_TYPES.CIRCLE_SIZE]: (a, b) => (a.beatmap?.circle_size || 0) - (b.beatmap?.circle_size || 0),
            [ScoreManager.SORT_TYPES.HP_DRAIN]: (a, b) => (a.beatmap?.hp_drain || 0) - (b.beatmap?.hp_drain || 0),
            [ScoreManager.SORT_TYPES.APPROACH_RATE]: (a, b) => (a.beatmap?.approach_rate || 0) - (b.beatmap?.approach_rate || 0),
            [ScoreManager.SORT_TYPES.OVERALL_DIFFICULTY]: (a, b) => (a.beatmap?.overall_difficulty || 0) - (b.beatmap?.overall_difficulty || 0)
        };

        const compareFunction = compareFunctions[sortType];
        if (compareFunction) {
            sortedScores.sort(compareFunction);
        }

        return sortOrder === ScoreManager.SORT_ORDER.DESC ? sortedScores.reverse() : sortedScores;
    }

    /**
     * Safe string comparison with null handling
     */
    compareStrings(a, b) {
        if (a == null || b == null) return 0;
        return a.localeCompare(b);
    }

    /**
     * Calculate accuracy with safety checks
     */
    calculateAccuracy(score) {
        if (typeof calculate_acc === 'function') {
            return calculate_acc(
                score.amount300 || 0,
                score.amount100 || 0,
                score.amount50 || 0,
                score.amountMisses || 0
            );
        }
        return 0;
    }

    /**
     * Handle search functionality
     */
    handleSearch() {
        if (!this.hasValidScores()) return;

        const searchQuery = this.elements.searchTextbox.value.toLowerCase();
        const scoresData = this.getScoresFromStorage();
        if (!scoresData) return;

        let filteredScores = this.applySearchFilters(scoresData, searchQuery);
        filteredScores = this.applyUserFilters(filteredScores);

        // Update global scores
        if (typeof scores !== 'undefined') {
            scores = filteredScores;
        }

        // Reset pagination to first page when search changes
        if (typeof page !== 'undefined') {
            page = 0;
        }

        // Update dashboard if available
        if (window.dashboard && typeof window.dashboard.setScores === 'function') {
            window.dashboard.setScores(filteredScores);
            window.dashboard.setCurrentPage(0);
        } else if (typeof loadScores === 'function') {
            loadScores();
        }
    }

    /**
     * Apply search filters to scores
     */
    applySearchFilters(scoresArray, searchQuery) {
        if (!searchQuery.trim()) return scoresArray;

        const searchTerms = searchQuery.split(' ').filter(term => term.trim());
        
        return searchTerms.reduce((filtered, term) => {
            return filtered.filter(score => this.scoreMatchesSearchTerm(score, term));
        }, scoresArray);
    }

    /**
     * Check if a score matches a search term
     */
    scoreMatchesSearchTerm(score, term) {
        // Check mod filters
        if (this.isModSearch(term)) {
            return this.checkModFilter(score, term);
        }

        // Check attribute filters
        if (this.isAttributeSearch(term)) {
            return this.checkAttributeFilter(score, term);
        }

        // Ensure valid beatmap data
        if (!score.beatmap) {
            console.log('Score without beatmap found:', score);
            return false;
        }

        // Normalize data with defaults
        const normalizedScore = this.normalizeScoreData(score);

        return [
            normalizedScore.beatmap.song_title,
            normalizedScore.beatmap.artist,
            normalizedScore.playerName
        ].some(field => field.toLowerCase().includes(term));
    }

    /**
     * Normalize score data with default values
     */
    normalizeScoreData(score) {
        const normalized = { ...score };
        
        if (!normalized.beatmap) normalized.beatmap = {};
        
        if (!normalized.beatmap.artist) {
            normalized.beatmap.artist = ScoreManager.DEFAULT_VALUES.ARTIST;
        }
        
        if (!normalized.beatmap.song_title) {
            normalized.beatmap.song_title = ScoreManager.DEFAULT_VALUES.SONG_TITLE;
        }
        
        if (!normalized.playerName) {
            normalized.playerName = ScoreManager.DEFAULT_VALUES.PLAYER_NAME;
        }

        return normalized;
    }

    /**
     * Check if term is a mod search
     */
    isModSearch(term) {
        return Object.values(ScoreManager.MOD_OPERATORS).some(op => term.startsWith(op)) && term.length > 1;
    }

    /**
     * Check if term is an attribute search
     */
    isAttributeSearch(term) {
        return ScoreManager.COMPARISON_OPERATORS.some(op => term.includes(op));
    }

    /**
     * Check mod filter with improved pattern
     */
    checkModFilter(score, term) {
        const operator = term[0];
        const modString = term.substring(1);

        if (modString === 'nm') {
            const hasNoMods = (score.mods || 0) === 0;
            switch (operator) {
                case ScoreManager.MOD_OPERATORS.INCLUDE:
                case ScoreManager.MOD_OPERATORS.EXACT:
                    return hasNoMods;
                case ScoreManager.MOD_OPERATORS.EXCLUDE:
                    return !hasNoMods;
                default:
                    return false;
            }
        }

        if (typeof parseMods !== 'function') {
            console.warn('parseMods function not available');
            return false;
        }

        const queryMods = this.parseModString(modString);
        const scoreMods = this.parseModString(parseMods(score.mods || 0).toLowerCase());

        switch (operator) {
            case ScoreManager.MOD_OPERATORS.INCLUDE:
                return queryMods.every(mod => scoreMods.includes(mod));
            case ScoreManager.MOD_OPERATORS.EXCLUDE:
                return !queryMods.every(mod => scoreMods.includes(mod));
            case ScoreManager.MOD_OPERATORS.EXACT:
                return this.arraysEqual(queryMods.sort(), scoreMods.sort());
            default:
                return false;
        }
    }

    /**
     * Parse mod string into array
     */
    parseModString(modString) {
        return modString.split(/(..)/g).filter(s => s.length === 2);
    }

    /**
     * Check if two arrays are equal
     */
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }

    /**
     * Check attribute filter
     */
    checkAttributeFilter(score, term) {
        const operatorMatch = term.match(/[><=]+/);
        const valueMatch = term.match(/\d+(\.\d+)?/);
        
        if (!operatorMatch || !valueMatch) return false;

        const operator = operatorMatch[0];
        const value = parseFloat(valueMatch[0]);
        const attribute = term.replace(operator, '').replace(valueMatch[0], '');

        const scoreValue = this.getScoreAttribute(score, attribute);
        if (scoreValue === null) return false;

        return this.compareValues(operator, value, scoreValue);
    }

    /**
     * Get score attribute value
     */
    getScoreAttribute(score, attribute) {
        const attributeMap = {
            pp: score.currentPP,
            maxpp: score.maxPP,
            combo: score.maxcombo,
            acc: this.calculateAccuracy(score),
            sr: score.star_rating,
            bpm: score.bpm,
            cs: score.beatmap?.circle_size,
            hp: score.beatmap?.hp_drain,
            ar: score.beatmap?.approach_rate,
            od: score.beatmap?.overall_difficulty
        };

        return attributeMap[attribute] ?? null;
    }

    /**
     * Compare values using operator
     */
    compareValues(operator, queryValue, scoreValue) {
        switch (operator) {
            case '>': return scoreValue > queryValue;
            case '<': return scoreValue < queryValue;
            case '=': return scoreValue === queryValue;
            case '>=': return scoreValue >= queryValue;
            case '<=': return scoreValue <= queryValue;
            default: return false;
        }
    }

    /**
     * Apply user filters
     */
    applyUserFilters(scoresArray) {
        const checkedUsers = Array.from(document.querySelectorAll('.user-checkbox input:checked'))
            .map(checkbox => checkbox.name);

        if (checkedUsers.length === 0) return scoresArray;

        return scoresArray.filter(score => {
            const playerName = score.playerName || '';
            const trimmedPlayerName = playerName.trim();
            
            // Check if the exact player name is in checked users
            if (checkedUsers.includes(playerName)) {
                return true;
            }
            
            // Check if this is a guest player (empty or whitespace-only name)
            // and "Guest (Offline)" is selected
            if (trimmedPlayerName === '' && checkedUsers.includes(ScoreManager.DEFAULT_VALUES.GUEST_NAME)) {
                return true;
            }
            
            return false;
        });
    }

    /**
     * Handle user search
     */
    handleUserSearch() {
        if (!this.hasValidScores()) return;

        const searchQuery = this.elements.userSearchInput.value.toLowerCase();
        const checkboxes = document.querySelectorAll('.user-checkbox input');

        checkboxes.forEach(checkbox => {
            const userName = checkbox.name.toLowerCase();
            const shouldShow = searchQuery === '' || userName.includes(searchQuery);
            checkbox.parentElement.style.display = shouldShow ? 'flex' : 'none';
        });
    }

    /**
     * Handle reset user search
     */
    handleResetUserSearch() {
        this.elements.userSearchInput.value = '';

        const checkboxes = document.querySelectorAll('.user-checkbox input');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.parentElement.style.display = 'flex';
        });

        const scoresData = this.getScoresFromStorage();
        if (scoresData && typeof scores !== 'undefined') {
            scores = scoresData;
        }

        // Reset pagination to first page
        if (typeof page !== 'undefined') {
            page = 0;
        }

        // Update dashboard if available
        if (window.dashboard && typeof window.dashboard.setScores === 'function') {
            window.dashboard.setScores(scoresData || []);
            window.dashboard.setCurrentPage(0);
        } else if (typeof loadScores === 'function') {
            loadScores();
        }
    }

    /**
     * Handle cache reset
     */
    handleResetCache() {
        try {
            localStorage.removeItem('scores');
            localStorage.removeItem('osu_path');
            location.reload();
        } catch (error) {
            console.error('Error resetting cache:', error);
        }
    }
}

// Initialize the score manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scoreManager = new ScoreManager();
});

// Fallback for immediate execution if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.scoreManager) {
            window.scoreManager = new ScoreManager();
        }
    });
} else {
    window.scoreManager = new ScoreManager();
}
