/**
 * OsuReplayDashboard - Main application class for managing osu! replay data
 */
class OsuReplayDashboard {
    static CONFIG = {
        ELEMENTS_PER_PAGE: 30,
        DEFAULT_PAGE: 0,
        DATE_FORMAT_OPTIONS: { day: '2-digit', month: '2-digit', year: 'numeric' },
        FILENAME_MAX_LENGTH: 40,
        STORAGE_KEYS: {
            OSU_PATH: 'osu_path',
            SCORES: 'scores'
        },
        ERROR_MESSAGES: {
            NO_FOLDER_SELECTED: 'No folder selected',
            INCORRECT_FOLDER: 'Incorrect folder selected'
        },
        DEFAULT_VALUES: {
            UNKNOWN_ARTIST: 'Unknown Artist',
            UNKNOWN_SONG: 'Unknown Song',
            GUEST_PLAYER: 'Guest (Offline)'
        }
    };

    static OSU_MODS = {
        1: 'NF',   // No Fail
        2: 'EZ',   // Easy
        4: 'TD',   // Touch Device
        8: 'HD',   // Hidden
        16: 'HR',  // Hard Rock
        32: 'SD',  // Sudden Death
        64: 'DT',  // Double Time
        128: 'RX', // Relax
        256: 'HT', // Half Time
        512: 'NC', // Nightcore (DT + NC)
        1024: 'FL', // Flashlight
        2048: 'Autoplay',
        4096: 'SO', // Spun Out
        8192: 'AP', // Autopilot
        16384: 'PF', // Perfect (SD + PF)
        32768: 'Key4',
        65536: 'Key5',
        131072: 'Key6',
        262144: 'Key7',
        524288: 'Key8',
        1048576: 'Fade In',
        2097152: 'Random',
        4194304: 'Cinema',
        8388608: 'Target',
        16777216: 'Key9',
        33554432: 'KeyCoop',
        67108864: 'Key1',
        134217728: 'Key3',
        268435456: 'Key2',
        536870912: 'ScoreV2',
        1073741824: 'Mirror'
    };

    constructor() {
        this.currentPage = OsuReplayDashboard.CONFIG.DEFAULT_PAGE;
        this.scores = [];
        this.loadStartTime = 0;
        this.osuPath = null;

        this.initializeElements();
        this.initializeState();
        this.attachEventListeners();
        this.setupElectronAPIHandlers();
    }

    /**
     * Initialize DOM elements with validation
     */
    initializeElements() {
        this.elements = {
            select: document.getElementById('select'),
            refresh: document.getElementById('refresh'),
            filePathElement: document.getElementById('filePath'),
            loader: document.getElementById('loader'),
            scoreList: document.querySelector('.score-list'),
            prev: document.getElementById('prev'),
            next: document.getElementById('next'),
            pageCounter: document.getElementById('page'),
            pageInput: document.getElementById('pageInput'),
            userCheckboxContainer: document.querySelector('.user-checkbox-container')
        };

        // Validate all required elements exist
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Required element not found: ${key}`);
            }
        });
    }

    /**
     * Initialize application state
     */
    initializeState() {
        // Load osu path from storage
        this.osuPath = localStorage.getItem(OsuReplayDashboard.CONFIG.STORAGE_KEYS.OSU_PATH);
        if (this.osuPath && this.elements.filePathElement) {
            this.elements.filePathElement.innerText = this.osuPath;
            if (window.electronAPI?.setFolder) {
                window.electronAPI.setFolder(this.osuPath);
            }
        }

        // Load scores from storage
        this.loadScoresFromStorage();
        this.updateUI();
    }

    /**
     * Load scores from localStorage
     */
    loadScoresFromStorage() {
        try {
            const storedScores = localStorage.getItem(OsuReplayDashboard.CONFIG.STORAGE_KEYS.SCORES);
            this.scores = storedScores ? JSON.parse(storedScores) : [];
            
            if (this.scores.length > 0) {
                this.renderScores();
                this.renderUsers();
                this.updatePaginationCounter();
            }
        } catch (error) {
            console.error('Error loading scores from storage:', error);
            this.scores = [];
        }
    }

    /**
     * Attach event listeners to DOM elements
     */
    attachEventListeners() {
        // Folder selection
        if (this.elements.select) {
            this.elements.select.addEventListener('click', () => this.handleFolderSelect());
        }

        // Refresh scores
        if (this.elements.refresh) {
            this.elements.refresh.addEventListener('click', () => this.handleRefresh());
        }

        // Pagination controls
        if (this.elements.prev) {
            this.elements.prev.addEventListener('click', () => this.handlePreviousPage());
        }

        if (this.elements.next) {
            this.elements.next.addEventListener('click', () => this.handleNextPage());
        }

        // Page input
        if (this.elements.pageInput) {
            this.elements.pageInput.addEventListener('focusout', () => this.handlePageInputChange());
            this.elements.pageInput.addEventListener('keydown', (e) => this.handlePageInputKeydown(e));
        }
    }

    /**
     * Setup Electron API event handlers
     */
    setupElectronAPIHandlers() {
        if (!window.electronAPI?.receive) return;

        window.electronAPI.receive('load-scores-success', (data) => this.handleLoadScoresSuccess(data));
        window.electronAPI.receive('load-scores-error', (errorMessage) => this.handleLoadScoresError(errorMessage));
        window.electronAPI.receive('save-replay-error', (errorMessage) => this.handleSaveReplayError(errorMessage));
        window.electronAPI.receive('save-replay-success', (message) => this.handleSaveReplaySuccess(message));
        window.electronAPI.receive('open-replay-success', (message) => this.handleOpenReplaySuccess(message));
        window.electronAPI.receive('open-replay-error', (errorMessage) => this.handleOpenReplayError(errorMessage));
    }

    /**
     * Handle folder selection
     */
    async handleFolderSelect() {
        if (!window.electronAPI?.selectFolder) return;

        try {
            const filePath = await window.electronAPI.selectFolder();
            
            if (!filePath) {
                this.setFilePathText(OsuReplayDashboard.CONFIG.ERROR_MESSAGES.INCORRECT_FOLDER);
                return;
            }

            this.setFilePathText(filePath);
            this.osuPath = filePath;
            localStorage.setItem(OsuReplayDashboard.CONFIG.STORAGE_KEYS.OSU_PATH, filePath);
        } catch (error) {
            console.error('Error selecting folder:', error);
            this.setFilePathText(OsuReplayDashboard.CONFIG.ERROR_MESSAGES.INCORRECT_FOLDER);
        }
    }

    /**
     * Handle refresh button click
     */
    async handleRefresh() {
        if (!this.osuPath) {
            this.setFilePathText(OsuReplayDashboard.CONFIG.ERROR_MESSAGES.NO_FOLDER_SELECTED);
            return;
        }

        if (!window.electronAPI?.loadScores) return;

        try {
            window.electronAPI.loadScores();
            this.showLoader();
            this.loadStartTime = Date.now();
        } catch (error) {
            console.error('Error loading scores:', error);
            this.hideLoader();
        }
    }

    /**
     * Handle pagination - previous page
     */
    handlePreviousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderScores();
            this.updatePaginationCounter();
        }
    }

    /**
     * Handle pagination - next page
     */
    handleNextPage() {
        const maxPage = this.getMaxPage();
        if (this.currentPage < maxPage - 1) {
            this.currentPage++;
            this.renderScores();
            this.updatePaginationCounter();
        }
    }

    /**
     * Handle page input change
     */
    handlePageInputChange() {
        if (!this.scores.length) {
            this.elements.pageInput?.blur();
            return;
        }

        const value = this.parsePageInput();
        this.setPageAndRender(value);
        this.elements.pageInput?.blur();
    }

    /**
     * Handle page input keydown
     */
    handlePageInputKeydown(event) {
        if (event.key === 'Enter') {
            if (!this.scores.length) {
                this.elements.pageInput?.blur();
                return;
            }

            const value = this.parsePageInput();
            this.setPageAndRender(value);
            this.elements.pageInput?.blur();
        }
    }

    /**
     * Parse and validate page input value
     */
    parsePageInput() {
        const inputValue = parseInt(this.elements.pageInput?.value || '1');
        const maxPage = this.getMaxPage();

        if (inputValue < 1) return 0;
        if (inputValue > maxPage) return maxPage - 1;
        return inputValue - 1; // Convert to 0-based index
    }

    /**
     * Set page and render scores
     */
    setPageAndRender(page) {
        this.currentPage = page;
        this.renderScores();
        this.updatePaginationCounter();
    }

    /**
     * Handle successful score loading
     */
    handleLoadScoresSuccess(data) {
        this.hideLoader();
        
        this.scores = Array.isArray(data) ? [...data] : [];
        this.saveScoresToStorage();
        
        this.currentPage = OsuReplayDashboard.CONFIG.DEFAULT_PAGE;
        this.renderScores();
        this.renderUsers();
        this.updatePaginationCounter();
        
        const timeTaken = (Date.now() - this.loadStartTime) / 1000;
        console.log(`Success - Time taken: ${timeTaken}s`);
    }

    /**
     * Handle score loading error
     */
    handleLoadScoresError(errorMessage) {
        console.error('Load scores error:', errorMessage);
        this.hideLoader();
    }

    /**
     * Handle replay save error
     */
    handleSaveReplayError(errorMessage) {
        console.error('Save replay error:', errorMessage);
    }

    /**
     * Handle replay save success
     */
    handleSaveReplaySuccess(message) {
        console.log('Save replay success:', message);
    }

    /**
     * Handle replay open success
     */
    handleOpenReplaySuccess(message) {
        console.log('Open replay success:', message);
    }

    /**
     * Handle replay open error
     */
    handleOpenReplayError(errorMessage) {
        console.error('Open replay error:', errorMessage);
    }

    /**
     * Save scores to localStorage
     */
    saveScoresToStorage() {
        try {
            localStorage.setItem(
                OsuReplayDashboard.CONFIG.STORAGE_KEYS.SCORES, 
                JSON.stringify(this.scores)
            );
        } catch (error) {
            console.error('Error saving scores to storage:', error);
        }
    }

    /**
     * Calculate accuracy percentage
     */
    static calculateAccuracy(hits300, hits100, hits50, misses) {
        const totalHits = hits300 + hits100 + hits50 + misses;
        if (totalHits === 0) return 0;
        
        const weightedScore = (300 * hits300 + 100 * hits100 + 50 * hits50);
        const maxScore = totalHits * 300;
        
        return Number.parseFloat((weightedScore / maxScore * 100)).toFixed(2);
    }

    /**
     * Parse osu! mod number into readable string
     */
    static parseMods(modNumber) {
        const mods = [];

        for (const [key, value] of Object.entries(OsuReplayDashboard.OSU_MODS)) {
            if ((modNumber & parseInt(key)) !== 0) {
                mods.push(value);
            }
        }

        // Remove DT if NC is present (Nightcore includes Double Time)
        if (mods.includes('NC')) {
            return mods.filter(mod => mod !== 'DT');
        }

        return mods.length ? mods : ['No Mod'];
    }

    /**
     * Format timestamp to readable date string
     */
    static formatDate(timestamp) {
        const date = new Date(timestamp);
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        
        return `${day}-${month}-${year} ${hours}:${minutes} UTC`;
    }

    /**
     * Normalize score data with default values
     */
    static normalizeScoreData(score) {
        const normalized = { ...score };
        
        if (!normalized.beatmap) normalized.beatmap = {};
        
        if (!normalized.beatmap.artist) {
            normalized.beatmap.artist = OsuReplayDashboard.CONFIG.DEFAULT_VALUES.UNKNOWN_ARTIST;
        }
        
        if (!normalized.beatmap.song_title) {
            normalized.beatmap.song_title = OsuReplayDashboard.CONFIG.DEFAULT_VALUES.UNKNOWN_SONG;
        }
        
        if (!normalized.playerName || normalized.playerName.trim() === '') {
            normalized.playerName = OsuReplayDashboard.CONFIG.DEFAULT_VALUES.GUEST_PLAYER;
        }

        return normalized;
    }

    /**
     * Get all unique users from scores
     */
    getAllUsers() {
        const users = new Set();
        
        this.scores.forEach(score => {
            const playerName = score.playerName?.trim();
            if (!playerName) {
                users.add(OsuReplayDashboard.CONFIG.DEFAULT_VALUES.GUEST_PLAYER);
            } else {
                users.add(playerName);
            }
        });

        return Array.from(users).sort();
    }

    /**
     * Render user checkboxes
     */
    renderUsers() {
        if (!this.elements.userCheckboxContainer) return;

        const users = this.getAllUsers();
        this.elements.userCheckboxContainer.textContent = '';

        users.forEach(user => {
            const container = this.createUserCheckbox(user);
            this.elements.userCheckboxContainer.appendChild(container);
        });

        this.attachUserCheckboxListeners();
    }

    /**
     * Create user checkbox element
     */
    createUserCheckbox(user) {
        const container = document.createElement('div');
        container.classList.add('user-checkbox');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = user;
        checkbox.name = user;
        checkbox.checked = false;

        const label = document.createElement('label');
        label.htmlFor = user;
        label.innerText = user;

        container.appendChild(checkbox);
        container.appendChild(label);

        return container;
    }

    /**
     * Attach event listeners to user checkboxes
     */
    attachUserCheckboxListeners() {
        const checkboxes = document.querySelectorAll('.user-checkbox input');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.handleUserFilterChange());
        });
    }

    handleUserFilterChange() {
        const checkedUsers = Array.from(document.querySelectorAll('.user-checkbox input:checked'))
            .map(checkbox => checkbox.name);

        if (checkedUsers.length === 0) {
            this.loadScoresFromStorage();
        } else {
            const originalScores = JSON.parse(
                localStorage.getItem(OsuReplayDashboard.CONFIG.STORAGE_KEYS.SCORES) || '[]'
            );
            
            this.scores = originalScores.filter(score => {
                const playerName = score.playerName?.trim() || '';
                return checkedUsers.includes(score.playerName) || 
                       (playerName === '' && checkedUsers.includes(OsuReplayDashboard.CONFIG.DEFAULT_VALUES.GUEST_PLAYER));
            });
        }

        this.currentPage = OsuReplayDashboard.CONFIG.DEFAULT_PAGE;
        this.renderScores();
        this.updatePaginationCounter();
    }

    renderScores() {
        if (!this.elements.scoreList) return;

        this.elements.scoreList.textContent = '';

        const start = this.currentPage * OsuReplayDashboard.CONFIG.ELEMENTS_PER_PAGE;
        const end = start + OsuReplayDashboard.CONFIG.ELEMENTS_PER_PAGE;

        for (let i = start; i < end && i < this.scores.length; i++) {
            const scoreElement = this.createScoreElement(this.scores[i]);
            if (scoreElement) {
                this.elements.scoreList.appendChild(scoreElement);
            }
        }
    }

    createScoreElement(score) {
        const template = document.getElementById('score-item');
        if (!template) {
            console.warn('Score item template not found');
            return null;
        }

        const clone = document.importNode(template.content, true);
        const normalizedScore = OsuReplayDashboard.normalizeScoreData(score);

        this.populateScoreElement(clone, normalizedScore);
        this.attachScoreEventListeners(clone, normalizedScore);

        return clone;
    }

    populateScoreElement(element, score) {
        const selectors = {
            title: '#title',
            diff: '#diff',
            sr: '#sr',
            bpm: '#bpm',
            cs: '#cs',
            hp: '#hp',
            od: '#od',
            ar: '#ar',
            bg: '#bg',
            player: '#player',
            combo: '#combo',
            maxCombo: '#maxCombo',
            acc: '#acc',
            mods: '#mods',
            date: '#date',
            h300: '#h300',
            h100: '#h100',
            h50: '#h50',
            h0: '#h0',
            ppCurrent: '#ppCurrent',
            ppFC: '#ppFC'
        };

        // Basic information
        this.setElementText(element, selectors.title, `${score.beatmap.artist} - ${score.beatmap.song_title}`);
        this.setElementText(element, selectors.diff, `[${score.beatmap.difficulty || 'Unknown'}]`);
        
        // Beatmap stats
        this.setElementText(element, selectors.sr, Number.parseFloat(score.star_rating || 0).toFixed(1));
        this.setElementText(element, selectors.bpm, Number.parseFloat(score.bpm || 0).toFixed(0));
        this.setElementText(element, selectors.cs, Number.parseFloat(score.beatmap.circle_size || 0).toFixed(1));
        this.setElementText(element, selectors.hp, Number.parseFloat(score.beatmap.hp_drain || 0).toFixed(1));
        this.setElementText(element, selectors.od, Number.parseFloat(score.beatmap.overall_difficulty || 0).toFixed(1));
        this.setElementText(element, selectors.ar, Number.parseFloat(score.beatmap.approach_rate || 0).toFixed(1));

        // Background image
        const bgElement = element.querySelector(selectors.bg);
        if (bgElement && score.background_path) {
            bgElement.src = score.background_path;
        }

        // Player and score information
        this.setElementText(element, selectors.player, score.playerName);
        this.setElementText(element, selectors.combo, `${score.maxcombo || 0}x`);
        
        const maxComboText = `${score.map_max_combo || 0}x`;
        const isFC = (score.maxcombo || 0) === (score.map_max_combo || 0);
        this.setElementText(element, selectors.maxCombo, isFC ? `${maxComboText} (FC)` : maxComboText);

        // Accuracy and mods
        const accuracy = OsuReplayDashboard.calculateAccuracy(
            score.amount300 || 0,
            score.amount100 || 0,
            score.amount50 || 0,
            score.amountMisses || 0
        );
        this.setElementText(element, selectors.acc, `${accuracy}%`);
        
        const mods = OsuReplayDashboard.parseMods(score.mods || 0);
        this.setElementText(element, selectors.mods, `+${mods.join('')}`);

        // Date
        this.setElementText(element, selectors.date, OsuReplayDashboard.formatDate(score.timestamp));

        // Hit counts
        this.setElementText(element, selectors.h300, String(score.amount300 || 0));
        this.setElementText(element, selectors.h100, String(score.amount100 || 0));
        this.setElementText(element, selectors.h50, String(score.amount50 || 0));
        this.setElementText(element, selectors.h0, String(score.amountMisses || 0));

        // PP values
        this.setElementText(element, selectors.ppCurrent, Number.parseFloat(score.currentPP || 0).toFixed(2));
        this.setElementText(element, selectors.ppFC, Number.parseFloat(score.maxPP || 0).toFixed(2));
    }

    setElementText(parent, selector, text) {
        const element = parent.querySelector(selector);
        if (element) {
            element.innerText = text;
        }
    }

    attachScoreEventListeners(element, score) {
        // Download replay button
        const downloadButton = element.querySelector('.download-replay');
        if (downloadButton) {
            downloadButton.dataset.beatmapHash = score.beatmap.beatmap_hash || '';
            downloadButton.dataset.hash = score.replayHash || '';
            downloadButton.addEventListener('click', () => this.handleDownloadReplay(score));
        }

        // Open replay button
        const openButton = element.querySelector('.open-replay');
        if (openButton) {
            openButton.dataset.hash = score.replayHash || '';
            openButton.dataset.beatmapHash = score.beatmap.beatmap_hash || '';
            openButton.addEventListener('click', () => this.handleOpenReplay(score));
        }
    }

    handleDownloadReplay(score) {
        if (!window.electronAPI?.saveReplay) return;

        try {
            const date = new Date(score.timestamp);
            const formatter = new Intl.DateTimeFormat('en-GB', OsuReplayDashboard.CONFIG.DATE_FORMAT_OPTIONS);
            const maxLength = OsuReplayDashboard.CONFIG.FILENAME_MAX_LENGTH;
            
            const filename = `${score.playerName} - ${score.beatmap.song_title.slice(0, maxLength)}[${score.beatmap.difficulty.slice(0, maxLength)}](${formatter.format(date)}).osr`;
            
            window.electronAPI.saveReplay(
                score.beatmap.beatmap_hash,
                score.replayHash,
                filename
            );
        } catch (error) {
            console.error('Error downloading replay:', error);
        }
    }

    handleOpenReplay(score) {
        if (!window.electronAPI?.openReplay) return;

        try {
            window.electronAPI.openReplay(score.beatmap.beatmap_hash, score.replayHash);
        } catch (error) {
            console.error('Error opening replay:', error);
        }
    }

    getMaxPage() {
        return Math.ceil(this.scores.length / OsuReplayDashboard.CONFIG.ELEMENTS_PER_PAGE);
    }

    updatePaginationCounter() {
        if (!this.elements.pageCounter) return;

        const maxPage = this.getMaxPage();
        this.elements.pageCounter.innerText = `${this.currentPage + 1}/${maxPage || 1}`;
    }

    showLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'block';
        }
    }

    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
    }

    setFilePathText(text) {
        if (this.elements.filePathElement) {
            this.elements.filePathElement.innerText = text;
        }
    }

    updateUI() {
        this.updatePaginationCounter();
    }

    getScores() {
        return this.scores;
    }

    setScores(newScores) {
        this.scores = newScores;
        this.renderScores();
        this.updatePaginationCounter();
    }

    getCurrentPage() {
        return this.currentPage;
    }

    setCurrentPage(page) {
        this.currentPage = page;
        this.renderScores();
        this.updatePaginationCounter();
    }

    getElementsPerPage() {
        return OsuReplayDashboard.CONFIG.ELEMENTS_PER_PAGE;
    }

    getPageCounter() {
        return this.elements.pageCounter;
    }
}

function calculate_acc(h300, h100, h50, h0) {
    return OsuReplayDashboard.calculateAccuracy(h300, h100, h50, h0);
}

function parseMods(modNumber) {
    const mods = OsuReplayDashboard.parseMods(modNumber);
    return mods.length === 1 && mods[0] === 'No Mod' ? 'No Mod' : mods.join('');
}

function loadScores() {
    if (window.dashboard) {
        window.dashboard.renderScores();
    }
}

let scores, page, pageCounter, elemPerPage;

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new OsuReplayDashboard();
    
    scores = window.dashboard.getScores();
    page = window.dashboard.getCurrentPage();
    pageCounter = window.dashboard.getPageCounter();
    elemPerPage = window.dashboard.getElementsPerPage();
    
    const originalSetScores = window.dashboard.setScores;
    window.dashboard.setScores = function(newScores) {
        originalSetScores.call(this, newScores);
        scores = this.getScores();
    };
    
    const originalSetCurrentPage = window.dashboard.setCurrentPage;
    window.dashboard.setCurrentPage = function(newPage) {
        originalSetCurrentPage.call(this, newPage);
        page = this.getCurrentPage();
    };
});

if (document.readyState !== 'loading') {
    if (!window.dashboard) {
        window.dashboard = new OsuReplayDashboard();
        scores = window.dashboard.getScores();
        page = window.dashboard.getCurrentPage();
        pageCounter = window.dashboard.getPageCounter();
        elemPerPage = window.dashboard.getElementsPerPage();
    }
}
