document.addEventListener('DOMContentLoaded', async () => {
    let jsonData = null;
    let fuse = null;
    let allTags = new Set();
    let allWords = new Set();
    let currentAutocompleteItems = [];
    let selectedAutocompleteIndex = -1;

    // Load JSON data
    try {
        const response = await fetch('resources.json');
        jsonData = await response.json();
        await initializeFuse(jsonData);
        await collectSearchTerms(jsonData);
        renderTree(jsonData);
        showWelcomePage(jsonData.metadata);
    } catch (error) {
        console.error('Detailed error:', error);
        document.getElementById('tree').innerHTML = `Error loading data: ${error.message}`;
    }

    // Initialize fuzzy search
    async function initializeFuse(data) {
        const searchItems = [];
        
        Object.keys(data).forEach(category => {
            if (category !== 'metadata' && Array.isArray(data[category])) {
                data[category].forEach(item => {
                    searchItems.push({
                        category,
                        title: item.title,
                        description: item.description || '',
                        tags: item.tags || [],
                        url: Array.isArray(item.url) ? item.url.join(', ') : item.url,
                        ...item
                    });
                });
            }
        });

        const options = {
            includeScore: true,
            threshold: 0.3,
            keys: ['title', 'description', 'tags', 'category']
        };
        
        fuse = new Fuse(searchItems, options);
    }

    // Collect all unique tags and searchable words
    async function collectSearchTerms(data) {
        Object.keys(data).forEach(category => {
            if (category !== 'metadata' && Array.isArray(data[category])) {
                data[category].forEach(item => {
                    // Collect tags
                    if (item.tags) {
                        item.tags.forEach(tag => allTags.add(tag));
                    }
                    
                    // Collect words from titles
                    item.title.split(/\s+/).forEach(word => {
                        if (word.length > 2) allWords.add(word);
                    });
                    
                    // Collect words from description
                    if (item.description) {
                        item.description.split(/\s+/).forEach(word => {
                            if (word.length > 2) allWords.add(word);
                        });
                    }
                });
            }
        });
    }

    // Filter data by tags
    function filterByTags(tags) {
        if (!tags || tags.length === 0) return jsonData;
        
        const filteredData = {};
        Object.keys(jsonData).forEach(category => {
            if (category !== 'metadata' && Array.isArray(jsonData[category])) {
                const filtered = jsonData[category].filter(item => 
                    tags.every(tag => item.tags && item.tags.includes(tag))
                );
                if (filtered.length > 0) {
                    filteredData[category] = filtered;
                }
            }
        });
        return filteredData;
    }

    // Create and show autocomplete dropdown
    function showAutocomplete(input, cursorPosition) {
        const searchContainer = document.querySelector('.search-container');
        let dropdown = document.querySelector('.autocomplete-dropdown');
        
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';
            searchContainer.appendChild(dropdown);
        }

        // Get the current word being typed
        const value = input.value;
        const words = value.slice(0, cursorPosition).split(/\s+/);
        const currentWord = words[words.length - 1] || '';

        // Handle empty input special cases for @ and #
        if (currentWord === '@' || currentWord === '#') {
            const suggestions = currentWord === '@' 
                ? Array.from(allTags).map(tag => ({ text: tag, type: 'tag' }))
                : Array.from(new Set(
                    Object.entries(jsonData)
                        .filter(([key]) => key !== 'metadata')
                        .flatMap(([_, items]) => items)
                        .map(item => item.title)
                )).map(title => ({ text: title, type: 'title' }));

            currentAutocompleteItems = suggestions.slice(0, 10);
            
            if (currentAutocompleteItems.length > 0) {
                dropdown.innerHTML = currentAutocompleteItems
                    .map((item, index) => `
                        <div class="autocomplete-item" data-index="${index}">
                            <span class="item-text">${item.text}</span>
                            <span class="item-type">${item.type}</span>
                        </div>
                    `)
                    .join('');

                dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        applySuggestion(currentAutocompleteItems[item.dataset.index]);
                    });
                });

                dropdown.style.display = 'block';
                return;
            }
        }

        // Clear previous suggestions
        currentAutocompleteItems = [];
        selectedAutocompleteIndex = -1;

        if (currentWord && currentWord.length > 0) {
            const isTagSearch = currentWord.startsWith('@');
            const isTitleSearch = currentWord.startsWith('#');
            const searchTerm = isTagSearch ? currentWord.slice(1) : 
                             isTitleSearch ? currentWord.slice(1) : currentWord;

            // Show suggestions for @ and # even when empty, but require at least one character for words
            if ((searchTerm.length >= 0 && (isTagSearch || isTitleSearch)) || 
                (searchTerm.length > 0 && !isTagSearch && !isTitleSearch)) {
                
                let suggestions = [];
                if (isTagSearch) {
                    suggestions = Array.from(allTags)
                        .filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(tag => ({ text: tag, type: 'tag' }));
                } else if (isTitleSearch) {
                    suggestions = Array.from(new Set(
                        Object.entries(jsonData)
                            .filter(([key]) => key !== 'metadata')
                            .flatMap(([_, items]) => items)
                            .map(item => item.title)
                            .filter(title => title && title.toLowerCase().includes(searchTerm.toLowerCase()))
                    )).map(title => ({ text: title, type: 'title' }));
                } else {
                    suggestions = Array.from(allWords)
                        .filter(word => word.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(word => ({ text: word, type: 'word' }));
                }

                suggestions.sort((a, b) => {
                    const aStartsWith = a.text.toLowerCase().startsWith(searchTerm.toLowerCase());
                    const bStartsWith = b.text.toLowerCase().startsWith(searchTerm.toLowerCase());
                    if (aStartsWith && !bStartsWith) return -1;
                    if (!aStartsWith && bStartsWith) return 1;
                    return a.text.localeCompare(b.text);
                });

                currentAutocompleteItems = suggestions.slice(0, 10);

                if (currentAutocompleteItems.length > 0) {
                    dropdown.innerHTML = currentAutocompleteItems
                        .map((item, index) => `
                            <div class="autocomplete-item" data-index="${index}">
                                <span class="item-text">${searchTerm ? highlightMatch(item.text, searchTerm) : item.text}</span>
                                <span class="item-type">${item.type}</span>
                            </div>
                        `)
                        .join('');

                    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                        item.addEventListener('click', () => {
                            applySuggestion(currentAutocompleteItems[item.dataset.index]);
                        });
                    });

                    dropdown.style.display = 'block';
                    return;
                }
            }
        }

        dropdown.style.display = 'none';
    }

    // Highlight matching parts of suggestions
    function highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="match-highlight">$1</span>');
    }

    // Apply selected suggestion
    function applySuggestion(item) {
        const input = document.getElementById('search');
        const cursorPosition = input.selectionStart;
        const textBeforeCursor = input.value.slice(0, cursorPosition);
        const textAfterCursor = input.value.slice(cursorPosition);
        
        const words = textBeforeCursor.split(/\s+/);
        words[words.length - 1] = item.type === 'tag' ? `@${item.text}` : 
                                 item.type === 'title' ? `#${item.text}` : item.text;
        
        const newText = words.join(' ');
        input.value = newText + textAfterCursor;
        input.selectionStart = input.selectionEnd = newText.length;
        
        // Hide dropdown and trigger search
        const dropdown = document.querySelector('.autocomplete-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        
        input.dispatchEvent(new Event('input'));
    }

    // Handle keyboard navigation in autocomplete
    function handleAutocompleteKeydown(e) {
        const dropdown = document.querySelector('.autocomplete-dropdown');
        if (!dropdown || dropdown.style.display === 'none') return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, currentAutocompleteItems.length - 1);
                updateAutocompleteSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, 0);
                updateAutocompleteSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedAutocompleteIndex >= 0) {
                    applySuggestion(currentAutocompleteItems[selectedAutocompleteIndex]);
                }
                break;
            case 'Escape':
                dropdown.style.display = 'none';
                break;
        }
    }

    // Update visual selection in autocomplete dropdown
    function updateAutocompleteSelection() {
        const items = document.querySelectorAll('.autocomplete-item');
        items.forEach(item => item.classList.remove('selected'));
        if (selectedAutocompleteIndex >= 0) {
            items[selectedAutocompleteIndex].classList.add('selected');
            items[selectedAutocompleteIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Parse search input to separate tags and text
    function parseSearchInput(input) {
        const tags = [];
        const titles = [];
        let searchText = input;

        // Extract @tags
        const tagRegex = /@(\w+)/g;
        let match;
        while ((match = tagRegex.exec(input)) !== null) {
            tags.push(match[1]);
            // Remove the tag from search text
            searchText = searchText.replace(match[0], '');
        }

        // Extract #titles
        const titleRegex = /#([^#@\s]+)/g;
        while ((match = titleRegex.exec(input)) !== null) {
            titles.push(match[1]);
            // Remove the title search from text
            searchText = searchText.replace(match[0], '');
        }

        // Clean up search text
        searchText = searchText.trim();

        return { tags, titles, searchText };
    }

    // Show welcome page
    function showWelcomePage(metadata) {
        const previewContent = document.getElementById('preview-content');
        
        // Create the welcome container
        const container = document.createElement('div');
        container.className = 'preview-container welcome-page';

        // Title section
        const titleSection = document.createElement('div');
        titleSection.className = 'preview-title welcome-title';
        titleSection.textContent = 'Welcome to CVAS Resource Database';
        container.appendChild(titleSection);

        // Quick stats section
        const statsSection = document.createElement('div');
        statsSection.className = 'welcome-section';
        
        const totalEntries = Object.values(metadata.counts).reduce((a, b) => a + b, 0);
        const statsSection2 = document.createElement('div');
        statsSection2.className = 'welcome-section';
        statsSection2.innerHTML = `
            <div class="welcome-section-title">Database Overview</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${totalEntries}</div>
                    <div class="stat-label">Total Resources</div>
                </div>
                ${Object.entries(metadata.counts).map(([category, count]) => `
                    <div class="stat-item">
                        <div class="stat-value">${count}</div>
                        <div class="stat-label">${category}</div>
                    </div>
                `).join('')}
            </div>
            <div class="last-updated">Last Updated: ${metadata.lastUpdated}</div>
        `;
        container.appendChild(statsSection2);

        // How to use section
        const helpSection = document.createElement('div');
        helpSection.className = 'welcome-section';
        helpSection.innerHTML = `
            <div class="welcome-section-title">How to Use</div>
            <div class="help-grid">
                <div class="help-item">
                    <div class="help-title">🔍 Smart Search</div>
                    <div class="help-content">
                        Use the search bar for full-text search. Type to see suggestions.
                    </div>
                </div>
                <div class="help-item">
                    <div class="help-title">🏷️ Tag Filtering</div>
                    <div class="help-content">
                        Use @tag to filter by tags (e.g., @GEE, @Python). Click tags to add them to search.
                    </div>
                </div>
                <div class="help-item">
                    <div class="help-title">📚 Title Search</div>
                    <div class="help-content">
                        Use #title to search in titles (e.g., #CoastSat). Supports partial matches.
                    </div>
                </div>
                <div class="help-item">
                    <div class="help-title">📂 Categories</div>
                    <div class="help-content">
                        Click category headers to expand/collapse. Click items to view details.
                    </div>
                </div>
                <div class="help-item">
                    <div class="help-title">⌨️ Keyboard Tips</div>
                    <div class="help-content">
                        Use arrow keys to navigate suggestions, Enter to select, Esc to close.
                    </div>
                </div>
                <div class="help-item">
                    <div class="help-title">🔄 Combined Search</div>
                    <div class="help-content">
                        Mix search types: "@GEE #CoastSat python" to combine filters.
                    </div>
                </div>
            </div>
        `;
        container.appendChild(helpSection);

        // Popular tags section
        const tagsList = Array.from(allTags)
            .slice(0, 10)
            .map(tag => `<span class="tag" onclick="handleTagClick('${tag}')">${tag}</span>`)
            .join('');

        const tagsSection = document.createElement('div');
        tagsSection.className = 'welcome-section';
        tagsSection.innerHTML = `
            <div class="welcome-section-title">Popular Tags</div>
            <div class="welcome-tags-container">
                ${tagsList}
            </div>
        `;
        container.appendChild(tagsSection);

        // Clear previous content and add welcome page
        previewContent.innerHTML = '';
        previewContent.appendChild(container);
    }

    // Render JSON tree
    function renderTree(data) {
        const tree = document.getElementById('tree');
        tree.innerHTML = '';
        
        // Create category sections
        Object.keys(data).forEach(category => {
            if (category !== 'metadata') {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category';
                
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'category-header';
                categoryHeader.innerHTML = `
                    <span class="category-toggle">▶</span>
                    <span class="category-name">${category} (${data[category].length})</span>
                `;
                categoryDiv.appendChild(categoryHeader);

                const categoryContent = document.createElement('div');
                categoryContent.className = 'category-content hidden';

                if (Array.isArray(data[category])) {
                    data[category].forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'tree-item';
                        itemDiv.title = item.title;

                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'item-title';
                        titleSpan.textContent = item.title;
                        itemDiv.appendChild(titleSpan);

                        itemDiv.addEventListener('click', () => {
                            showPreview(item, category);
                            highlightActive(itemDiv);
                        });

                        categoryContent.appendChild(itemDiv);
                    });
                }

                categoryDiv.appendChild(categoryContent);
                tree.appendChild(categoryDiv);

                // Add click handler for category toggle
                categoryHeader.addEventListener('click', (e) => {
                    const content = categoryHeader.nextElementSibling;
                    const toggle = categoryHeader.querySelector('.category-toggle');
                    content.classList.toggle('hidden');
                    toggle.textContent = content.classList.contains('hidden') ? '▶' : '▼';
                });
            }
        });
    }

    // Show preview with enhanced formatting
    function showPreview(data, category) {
        const previewContent = document.getElementById('preview-content');
        
        // Create the preview container
        const container = document.createElement('div');
        container.className = 'preview-container';

        // Title section
        const titleSection = document.createElement('div');
        titleSection.className = 'preview-title';
        titleSection.textContent = data.title;
        container.appendChild(titleSection);

        // Metadata section
        const metadataSection = document.createElement('div');
        metadataSection.className = 'preview-metadata';

        // Create metadata items
        const metadataItems = [
            {
                label: 'Type',
                content: category
            },
            data.tags && {
                label: 'Tags',
                content: `<div class="tags-container">${
                    data.tags.map(tag => 
                        `<span class="tag" onclick="handleTagClick('${tag}')">${tag}</span>`
                    ).join('')
                }</div>`
            },
            data.year && {
                label: 'Year',
                content: data.year
            },
            data.dateAdded && {
                label: 'Added',
                content: data.dateAdded
            },
            (data.url || data.doi) && {
                label: 'Links',
                content: `<div class="links-container">
                    ${Array.isArray(data.url) ? 
                        data.url.map(url => `<a href="${url}" target="_blank" class="preview-link">URL</a>`).join(' ') :
                        data.url ? `<a href="${data.url}" target="_blank" class="preview-link">URL</a>` : ''
                    }
                    ${data.doi ? `<a href="${data.doi}" target="_blank" class="preview-link">DOI</a>` : ''}
                </div>`
            }
        ].filter(Boolean);

        metadataItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'metadata-item';
            div.innerHTML = `
                <span class="metadata-label">${item.label}:</span>
                <div class="metadata-content">${item.content}</div>
            `;
            metadataSection.appendChild(div);
        });

        container.appendChild(metadataSection);

        // Content section (abstract or description)
        if (data.abstract || data.description) {
            const contentSection = document.createElement('div');
            contentSection.className = 'preview-content-text';
            contentSection.innerHTML = `
                <div class="content-label">${data.abstract ? 'Abstract' : 'Description'}</div>
                <div class="content-text">${data.abstract || data.description}</div>
            `;
            container.appendChild(contentSection);
        }

        // Clear previous content and add new
        previewContent.innerHTML = '';
        previewContent.appendChild(container);
    }

    // Highlight active item
    function highlightActive(element) {
        document.querySelectorAll('.tree-item.active').forEach(el => {
            el.classList.remove('active');
        });
        element.classList.add('active');
    }

    // Handle tag click
    window.handleTagClick = function(tag) {
        const searchInput = document.getElementById('search');
        const newTag = `@${tag}`;
        const currentSearch = searchInput.value;
        
        searchInput.value = currentSearch ? `${currentSearch} ${newTag}` : newTag;
        searchInput.dispatchEvent(new Event('input'));
    };

    // Initialize search input event listeners
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
        showAutocomplete(e.target, e.target.selectionStart);
        const searchTerm = e.target.value.trim();
        
        if (!searchTerm) {
            renderTree(jsonData);
            return;
        }

        // Parse search input for tags, titles and text
        const { tags, titles, searchText } = parseSearchInput(searchTerm);
        
        // First filter by tags if any
        let filteredData = tags.length > 0 ? filterByTags(tags) : jsonData;

        // Then filter by titles if any
        if (titles.length > 0) {
            const titleFilteredData = {};
            Object.keys(filteredData).forEach(category => {
                if (category !== 'metadata' && Array.isArray(filteredData[category])) {
                    const filtered = filteredData[category].filter(item =>
                        titles.some(title =>
                            item.title.toLowerCase().includes(title.toLowerCase())
                        )
                    );
                    if (filtered.length > 0) {
                        titleFilteredData[category] = filtered;
                    }
                }
            });
            filteredData = titleFilteredData;
        }

        // Then apply text search if there's any
        if (searchText) {
            const results = fuse.search(searchText);
            const categorizedResults = {};
            
            results.forEach(({ item }) => {
                // Only include if it passed the previous filters
                if (filteredData[item.category] && 
                    filteredData[item.category].some(i => i.title === item.title)) {
                    if (!categorizedResults[item.category]) {
                        categorizedResults[item.category] = [];
                    }
                    categorizedResults[item.category].push(item);
                }
            });
            
            filteredData = categorizedResults;
        }

        renderTree(filteredData);
    });

    searchInput.addEventListener('keydown', handleAutocompleteKeydown);
    searchInput.addEventListener('click', (e) => showAutocomplete(e.target, e.target.selectionStart));
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            const dropdown = document.querySelector('.autocomplete-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });
});