(function () {
    /**
     * A verbose ID to avoid clashing with page content
     */
    const barId = 'jtl-search-1625492747';

    const MSG_TOGGLE = 0;
    const MSG_NAVIGATION = 1;

    const body = document.body ?? document.documentElement;

    let offsetX = 0, offsetY = 0;

    const highlightBgColor = 'rgba(0, 200, 50, .125)';
    const highlightSelectedBgColor = 'rgba(255, 162, 90, .125)';
    const highlightSelectedOutlineColor = 'rgb(255, 162, 90)';

    /**
     * Debounce utility. Replace with import if switching to bundler.
     * @param {*} func 
     * @param {*} delay 
     * @param {*} immediate 
     * @returns 
     */
    const debounce = (func, delay, immediate) => {
        let timerId;
        return (...args) => {
            const boundFunc = func.bind(this, ...args);
            clearTimeout(timerId);
            if (immediate && !timerId) {
                boundFunc();
            }
            const calleeFunc = immediate ? () => { timerId = null } : boundFunc;
            timerId = setTimeout(calleeFunc, delay);
        }
    }

    class SearchBar {
        constructor(element) {
            this.element = element;
            element.innerText = '';
            this.element.id = barId;
            this.highlightContainer = null;
            this.matches = [];
            this.coveredMatches = 0;
            this.linksOnPage = [];
            this.highlights = [];
            this.selectedIndex = null;
            this.rect = element.getBoundingClientRect();
            browser.storage.local.get('isRestrictedToViewport').then(
                ({ isRestrictedToViewport }) => {
                    this.isRestrictedToViewport = isRestrictedToViewport ?? false;
                }
            ).catch(() => {
                this.isRestrictedToViewport = false;
            }).finally(() => this.addCheckboxForViewportRestriction());
            this._visible = false;
            this._searchText = '';
            body.appendChild(this.element);
            this.updateZIndexes();
            this.addInput();
            this.addCurrentInfo();
            this.addCounter();
            this.addCloseIcon();
            this.addKeydownListener();
            this.updateAllLinks();
            this.addViewportListeners();

            /**
             * Update this.links in a MutationObserver observing whole document / document.body.
            */
            this.mutationObserver = new MutationObserver(
                debounce(() => {
                    this.updateZIndexes();
                    this.updateAllLinks();
                    this.updateMatches();
                    this.enableResizeObserver();
                }, 100, true)
            );

            this.resizeObserver = new ResizeObserver(
                debounce(() => {
                    if (this.visible) {
                        this.removeHighlightContainer();
                        this.addHighlightContainer();
                        this.addHighlights();
                        this.updateCountAndCurrent();
                    }
                }, 100, true)
            )
        }
        
        addViewportListeners() {
            this.resizeHandler = debounce(
                () => {
                if (this.visible) {
                    this.updateAllLinks();
                    this.updateOwnHeight();
                    this.updateMatches();
                }
            }, 50, true);
            this.scrollHandler = debounce(
                () => {
                if (this.visible) {
                    if (this.isRestrictedToViewport) {
                        this.updateMatches(false);
                    }
                }
            }, 75, true);

            window.addEventListener(
                'resize',
                this.resizeHandler
            );
            window.addEventListener(
                'scroll',
                this.scrollHandler
            );
            const loadListener = () => {
                this.updateAllLinks();
                if (this.visible) {
                    this.updateMatches();
                }
            };
            window.addEventListener('load', loadListener);
        }

        addInput() {
            const input = document.createElement('INPUT');
            input.type = 'search';
            const labelText = 'Search links';
            input.setAttribute('placeholder', labelText);
            input.setAttribute('aria-label', labelText);
            input.tabIndex = 1;
            input.classList.add('search');
            this.element.appendChild(input);
            input.addEventListener('input', e => {
                this.searchText = e.target.value;
            })
            this.input = input;
        }

        addCounter() {
            this.countEl = document.createElement('SPAN');
            this.countEl.classList.add('count');
            this.element.appendChild(this.countEl);
        }

        addCurrentInfo() {
            this.currentInfo = document.createElement('SPAN');
            this.currentInfo.classList.add('current');
            this.element.appendChild(this.currentInfo);
        }

        addCloseIcon() {
            this.closeIcon = document.createElement('BUTTON');
            this.closeIcon.innerText = '✖';
            setStyles({
                    border: 'none',
                    appearance: 'none',
                    background: 'none',
                    margin: '0 0 0 .5em',
                    cursor: 'pointer'
            }, this.closeIcon);
            this.closeIcon.addEventListener('click', () => {
                this.visible = false;
            });
            this.element.appendChild(this.closeIcon);
        }

        addCheckboxForViewportRestriction() {
            const checkbox = document.createElement('INPUT');
            checkbox.type = 'checkbox';
            checkbox.id = `${barId}-viewonly`;
            checkbox.checked = this.isRestrictedToViewport;
            const label = document.createElement('LABEL');
            label.innerText = 'Restrict to viewport';
            label.htmlFor = checkbox.id;
            setStyles({
                marginLeft: '.25em',
                fontSize: 'inherit'
            }, label);
            const wrap = document.createElement('FIELDSET');
            wrap.appendChild(checkbox);
            wrap.appendChild(label);
            setStyles({
                marginLeft: '.5em',
                fontSize: '.875rem'
            }, wrap);
            this.input.after(wrap);
            checkbox.addEventListener('change', e => {
                this.isRestrictedToViewport = e.target.checked;
                browser.storage.local.set({ 'isRestrictedToViewport': this.isRestrictedToViewport });
                this.input.focus();
                this.updateMatches();
            });
            this.updateCurrentInfo();
        }

        /**@param {boolean} visibility*/
        set visible(visibility) {
            this._visible = visibility ?? !this.visible;
            this.element.classList.toggle('visible', this.visible);
            if (this.visible) {
                window.top.focus();
                this.input.focus();
                this.addHighlightContainer();
                this.updateOwnHeight();
                this.updateAllLinks();
                this.updateMatches();
                this.enableObservers();
            }
            else {
                this.removeHighlightContainer();
                this.disableObservers();
            }
        }
        get visible() {
            return this._visible;
        }

        /**@param {string} searchText*/
        set searchText(searchText) {
            this._searchText = searchText;
            this.updateMatches();
            if (this.matches.length > 0) {
                this.selectedIndex = 0;
            }
            else {
                this.selectedIndex = null;
            }
        }
        get searchText() {
            return this._searchText;
        }

        updateOwnHeight() {
            this.rect = this.element.getBoundingClientRect();
        }

        updateAllLinks() {
            this.allLinks = Array.from(document.querySelectorAll('a[href], button'));
        }

        updateMatches(updateScroll = true) {
            if (this.searchText === '') {
                this.matches = [];
                this.selectedIndex = null;
            }
            else {
                const countOld = this.matches.length;
                /*
                 * Quick&dirty, inefficient "search" without ANY optimization 
                   - no (inverted) index, XPath or anything like that. 
                 */
                this.matches = this.allLinks.filter(
                    targetElement => {
                        const rect = targetElement.getBoundingClientRect();
                        /*early return for elements with invisible bounding box.*/
                        if (rect.width < 1 || rect.height < 1)
                            return false;
                        /*check search criterion*/
                        let isMatch = targetElement.innerText.toLowerCase().indexOf(this.searchText) !== -1 ||
                            (targetElement instanceof HTMLAnchorElement &&
                                removeCurrentUrlFromStartOfString(targetElement.href)
                                    .toLowerCase()
                                    .indexOf(this.searchText) !== -1
                            );
                        /*
                         * Check if element is in viewport when option is enabled.
                         */
                        if (this.isRestrictedToViewport) {
                            isMatch = isMatch &&
                                rect.bottom > 0 && rect.top < window.innerHeight;
                        }
                        /**
                         * @todo Filter out elements that are covered completely by another element.
                         * Could be done using document.elementFromPoint on the corners of the element. 
                         * Expensive, so should be done in background?
                         */
                        return isMatch;
                    }
                );
                if (this.isRestrictedToViewport) {
                    this.filterOutCoveredMatches();
                }

                /*reset selected match when number of results changes*/
                if (countOld !== this.matches.length) {
                    this.selectedIndex = this.matches.length > 0 ? 0 : null;
                }
            }

            if (this.highlightContainer) {
                this.addHighlights();
            }

            this.updateCountAndCurrent(updateScroll);
        }

        addHighlights() {
            if (this.highlightContainer) {
                this.highlights = [];
                this.highlightContainer.innerText = '';
                for (const match of this.matches) {
                    const highlight = addHighlightForTargetElement(match, this.highlightContainer);
                    this.highlights.push(
                        highlight
                    );
                }
            }
        }

        /**
         * Update the highlight element for the currently "selected" link-overlay (it is not actually focused).
         */
        updateHighlightForCurrent(updateScroll) {
            if (this.selectedIndex !== null) {
                const selectedHighlightEl = this.highlights[this.selectedIndex];
                const selectedLink = this.matches[this.selectedIndex];
                const color = getComputedStyle(selectedLink).color;
                setStyles(
                    {
                        border: '1px solid ${color}',
                        backgroundColor: highlightSelectedBgColor,
                        // outline: `1px dotted ${color}`
                        outline: `3px dotted ${highlightSelectedOutlineColor}`,
                    }, selectedHighlightEl
                );
                this.resetAdjacentHighlights();
                if (updateScroll) {
                    scrollIntoView(selectedLink, this.rect.height);
                }
            }
        }
        resetAdjacentHighlights() {
            const elsToReset = [];
            const hLength = this.highlights.length;
            if (hLength > 1) {
                elsToReset.push(
                    this.highlights[(this.selectedIndex + 1) % hLength]
                )
            }
            if (hLength > 2) {
                elsToReset.push(
                    this.highlights[modCycleNegatives(this.selectedIndex - 1, hLength)]
                )
            }
            if (elsToReset.length > 0) {
                elsToReset.forEach(el => setStyles(
                    {
                        border: null,
                        backgroundColor: highlightBgColor,
                        outline: null
                    },
                    el
                ));
            }
        }

        updateCount() {
            this.countEl.style.visibility = this.matches.length > 0 ? 'visible' : 'hidden';
            this.countEl.innerText = `${this.selectedIndex + 1} / ${this.matches.length}`;
        }

        updateCurrentInfo() {
            this.currentInfo.innerText = '';
            this.currentInfo.setAttribute('title', '');
            if (this.selectedIndex !== null && this.matches.length > 0) {
                const currentLink = this.matches[this.selectedIndex];
                let text = currentLink.innerText.replace(/\n+|\s\s/g, ' ');
                text = text.length > 32 ? text.slice(0, 32) + '...' : text;
                let url = this.matches[this.selectedIndex].href ?? '';
                url = url.length > 64 ? url.slice(0, 32) + '...' + url.slice(-32) : url;
                const textEl = document.createElement('STRONG');
                const urlEl = document.createElement('SPAN');
                urlEl.style.marginLeft = '0.5em';
                textEl.innerText = text;
                urlEl.innerText = url;
                for (const el of [urlEl, textEl, this.currentInfo]) {
                    el.setAttribute('title', url);
                }
                for (const el of [textEl, urlEl]) {
                    this.currentInfo.appendChild(el);
                }
            }
            else {
                const infoText = document.createElement('SMALL');
                infoText.innerText = this.matches.length === 0 && this.searchText.length > 0 ?
                    'No matching links found.'
                    : `Type to search links ${this.isRestrictedToViewport ? 'in the current viewport' : 'on the current page'}. Hit ENTER to go to the selected link. Use TAB or F3 to cycle through matching results.`;
                this.currentInfo.appendChild(infoText);
            }
        }

        updateCountAndCurrent(updateScroll = true) {
            this.updateCount();
            this.updateHighlightForCurrent(updateScroll);
            this.updateCurrentInfo();
        }

        addKeydownListener() {
            this.keydownListener = event => {
                switch (event.key) {
                    case 'Escape':
                        this.visible = false;
                        this.searchText = '';
                        break;
                    case 'Tab':
                    case 'F3':
                        event.preventDefault();
                        this.selectedIndex = (this.selectedIndex + 1) % this.matches.length;
                        this.updateCountAndCurrent();
                        break;
                    case 'Space':
                    case 'Enter':
                        if (this.selectedIndex !== null) {
                            const match = this.matches[this.selectedIndex];
                            if (match) {
                                match.focus();
                                match.click();
                            }
                        }
                }
            };
            this.element.addEventListener('keydown', this.keydownListener);
        }

        updateZIndexes() {
            this.maxBodyChildZ = getMaxZOfChildren(body);
            this.element.style.zIndex = this.maxBodyChildZ + 2;
        }

        addHighlightContainer() {
            this.updateZIndexes();
            this.highlightContainer = document.createElement('DIV');
            setStyles({
                position: 'relative',
                pointerEvents: 'none',
                zIndex: this.maxBodyChildZ + 1
            }, this.highlightContainer);
            body.prepend(this.highlightContainer);
        }

        removeHighlightContainer() {
            body.removeChild(this.highlightContainer);
            this.highlightContainer = null;
        }

        enableObservers() {
            this.mutationObserver.observe(body, { attributes: true, childList: true, characterData: true });
            this.enableResizeObserver();
        }
        enableResizeObserver() {
            this.resizeObserver.disconnect();
            const observeChildren = node => {
                if (getComputedStyle(node).overflow === 'hidden' && node.children.length > 0) {
                    observeChildren(node);
                }
                else {
                    this.resizeObserver.observe(node);
                }
            };
            Array.from(body.children).forEach(immediateBodyChild => {
                observeChildren(immediateBodyChild)
            })
        }

        disableObservers() {
            this.mutationObserver.disconnect();
            this.resizeObserver.disconnect();
        }

        filterOutCoveredMatches() {
            const filteredMatches = [];
            const coveredMatches = []
            for (const match of this.matches) {
                const { top, right, bottom, left } = match.getBoundingClientRect();
                if ([
                    [left, top], [left, bottom], [right, top], [right, bottom]
                ].every(
                    ([x, y]) => document.elementFromPoint(x, y) !== match
                )) {
                    coveredMatches.push(match);
                }
                else {
                    filteredMatches.push(match);
                }
            }
            this.matches = filteredMatches;
            this.coveredMatches = coveredMatches;
        }
        destroy() {
            this.disableObservers();
            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('scroll', this.scrollHandler);
            this.element.removeEventListener('keydown', this.keydownListener);
            if (this.highlightContainer !== null) {
                this.removeHighlightContainer();
            }
            body.removeChild(this.element);
        }
    }
    let searchBarElement, searchBar;
    const init = () => {
        if (searchBar) {
            searchBar.destroy();
        }
        searchBarElement = document.createElement('ASIDE');
        searchBar = new SearchBar(searchBarElement);
    }

    init();
    
    browser.runtime.onMessage.addListener(msg => {
        switch (msg) {
            case MSG_TOGGLE:
                searchBar.visible = !searchBar.visible;
                break;
            case MSG_NAVIGATION:
                init();
                break;
        }
    })

    /**
     * Highlight a link/button. 
     * @param {HTMLAnchorElement|HTMLButtonElement} targetElement 
     */
    function addHighlightForTargetElement(targetElement, highlightContainer) {
        const rect = targetElement.getBoundingClientRect();
        const offsets = {
            top: rect.top + window.scrollY - offsetY,
            left: rect.left + window.scrollX - offsetX,
            width: rect.width,
            height: rect.height
        };
        return createHighlightElement(offsets, highlightContainer);
    }

    function createHighlightElement(rect, parent, bodyOffset) {
        const el = document.createElement('SPAN');
        const styles = {
            display: 'inline-block',
            position: 'absolute',
            backgroundColor: highlightBgColor,
            border: null,
            top: rect.top - parent.offsetTop,
            left: rect.left - parent.offsetLeft,
            height: rect.height,
            width: rect.width
        };
        setStyles(styles, el);
        parent.appendChild(el);
        return el;
    }

    /**
     * Set CSS styles from an object.
     * Only removes styles if the value NULL is explicitly set to the corresponding property.
     * @param {HTMLAnchorElement} link 
     */
    function setStyles(styles, element) {

        const cssImplicitPixelProps = ['top', 'right', 'bottom', 'left', 'width', 'height', 'minWidth', 'minHeight'];
        const cssValueString = (property, val) => cssImplicitPixelProps.includes(property) ? val.toString() + 'px' : val.toString();

        for (const cssPropertyName of Object.keys(styles)) {
            try {

                if (styles[cssPropertyName] === null) {
                    element.style.removeProperty(cssPropertyName);
                } else {
                    element.style[cssPropertyName] = cssValueString(cssPropertyName, styles[cssPropertyName]);
                }
            }
            catch (e) {
                console.error('Failed to set inline CSS - ', e, e.stack)
            }
        }

    }
    /**
     * Get max. z-index of children.
     * @param {HTMLElement} element
     */
    function getMaxZOfChildren(element, maxIterations = 8, iteration = 0) {
        return Array.from(element.children).reduce(
            (prev, curr) => {
                const computedZ = getComputedStyle(curr).zIndex;
                const z = computedZ === 'auto' ? prev : parseInt(computedZ, 10);
                if (curr.children.length > 0 && iteration < maxIterations) {
                    const maxChildZ = getMaxZOfChildren(curr, maxIterations, iteration + 1);
                    if (maxChildZ > z && z >= prev) {
                        return maxChildZ;
                    }
                    else {
                        return z > prev ? z : prev;
                    }
                }
                else {
                    return z > prev ? z : prev;
                }
            }, 0
        )
    }

    function modCycleNegatives(n, m) {
        return n < 0 ? Math.abs((n + n % m) % m) : n % m;
    }

    //primitive search for fixed header height. currently only for immediate children of body.
    function getImplicitScrollMarginTop(parent, maxIterations = 4, iteration = 0) {
        let result = 0;
        for (element of Array.from(parent.children)) {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (
                (style.position === 'fixed' || style.position === 'absolute' || style.position === 'sticky')
                && rect.height > result && rect.top < 200
            ) {
                result = rect.height;
            }
            if (element.children.length > 0 && iteration < maxIterations) {
                const maxChildH = getImplicitScrollMarginTop(element, maxIterations, iteration + 1);
                if (maxChildH > result) {
                    result = maxChildH;
                }
            }
        }
        return result;
    }

    /**
     * @param {HTMLElement} element
     */
    function scrollIntoView(element, minBottomSpace = 0) {
        const rect = element.getBoundingClientRect();
        const implicitMarginTop = getImplicitScrollMarginTop(body);
        const spaceToViewBottom = window.innerHeight - rect.bottom;
        if (rect.top < implicitMarginTop || spaceToViewBottom < Math.max(rect.height, minBottomSpace)) {
            let targetY = rect.top + window.scrollY - implicitMarginTop;
            if (rect.top - implicitMarginTop > window.innerHeight - minBottomSpace) {
                targetY += minBottomSpace;
            }
            window.scrollTo(window.scrollX, targetY);
        }
    }

    function removeCurrentUrlFromStartOfString(href) {
        //if href starts with the url of the current page, remove it to avoid false-positives for relative links
        return href.replace(new RegExp(`^${escapeForRegExp(window.location.href)}`), '');
    }
    function escapeForRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
})()