import {getHostname} from './hostname.js';

(async () => {
    try {
        // Get the hostname of the server
        const hostname = await getHostname();

        // Redirect to the target page (if it is a special page)
        await doRedir(window.location.pathname, hostname);

        // Import the QRCodeStyling module
        const QRCodeStyling = (await import('qr-code-styling')).default;

        // Bind the shortened URL events
        await bindShortenEvents(hostname, QRCodeStyling);
    } catch (error) {
        console.error('Initialization error:', error);
        alert('An error occurred during initialization. Please try again.');
    }
})();

/**
 * Redirect to the target page (if it is a special page)
 * @param suffix - The path suffix from location.pathname
 * @param hostname - The hostname of the server
 * @returns {Promise<void>}
 */
async function doRedir(suffix, hostname) {
    // If it is the home page "/", do nothing
    if (suffix === '/') return;

    // List of pages that need to be redirected directly
    const otherPages = ['/admin', '/login', '/logout', '/change_pass'];
    if (otherPages.includes(suffix)) {
        // Redirect to the page (ex: /admin -> /admin/)
        // console.log(suffix);
        window.location.href = `${hostname}${suffix}/`;
        return;
    }

    // If matched none of the above, try to search the record
    const shortKey = suffix.substring(1); // Get rid of the leading "/"
    try {
        const response = await fetch(`${hostname}/api/v1/search_record?` + new URLSearchParams({
            short_key: shortKey,
        }).toString(), {
            method: 'GET',
        });

        const data = await response.json();
        if (data.status) {
            // If the record is found, redirect to the original URL
            window.location.href = data.data.original_url;
        } else {
            // If the record is not found, redirect to the home page
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Redirection error:', error);
        // Redirect to the home page when an error occurs
        window.location.href = '/';
    }
}

/**
 * Bind the shorten URL events (button, form)
 * @param hostname - The hostname of the server
 * @param QRCodeStyling - The QRCodeStyling module after dynamic import
 * @returns {Promise<void>}
 */
async function bindShortenEvents(hostname, QRCodeStyling) {
    // Bind the click event of all "Shorten URL" buttons
    document.querySelectorAll('.js-shorten-url-button').forEach((button) => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            doShorten(hostname, QRCodeStyling);
        });
    });

    // Bind the form submission event
    const formElement = document.querySelector('form');
    if (formElement) {
        formElement.addEventListener('submit', (event) => {
            event.preventDefault();
            doShorten(hostname, QRCodeStyling);
        });
    }
}

/**
 * Perform the shorten URL process
 * @param {string} hostname - The hostname of the server
 * @param {any} QRCodeStyling - The QRCodeStyling module after dynamic import
 */
async function doShorten(hostname, QRCodeStyling) {
    // Get the user input URL and turn it into lowercase
    const inputField = document.querySelector('.js-shorten-url-field');
    if (!inputField) return;

    let url = inputField.value.trim();
    if (!url) return;
    if (url.indexOf(' ') !== -1) {
        alert('URL should not contain spaces.');
        return;
    }

    // Check if it is dark mode, and get the corresponding colors
    const isDarkMode = document.body.classList.contains('darkmode');
    const dotColor = getComputedStyle(document.documentElement)
        .getPropertyValue(isDarkMode ? '--qrcode-dot-color-dark' : '--qrcode-dot-color')
        .trim();
    const backColor = getComputedStyle(document.documentElement)
        .getPropertyValue(isDarkMode ? '--qrcode-background-color-dark' : '--qrcode-background-color')
        .trim();

    try {
        // Send the request to create a new record
        const response = await fetch(`${hostname}/api/v1/create_record`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({"url": url}).toString(),
        });
        const data = await response.json();

        const shortenedKey = data?.data?.shortened_key;
        const shortenedUrl = `${hostname}/${shortenedKey}`;
        if (!shortenedUrl) {
            alert('Failed to shorten the URL. Please try again.');
            return;
        }

        // If the URL after trimming space from the right and the left is still empty, do nothing
        url = inputField.value.trim();
        if (!url) return;

        // If the URL does not start with "http://" or "https://", add "https://"
        if (!/^https?:\/\//.test(url)) {
            url = `https://${url}`;
        }

        // Clear the input field
        inputField.value = '';

        // Render the shortened URL, QRCode, and copy functionality
        renderShortenedResult(url, shortenedUrl, dotColor, backColor, QRCodeStyling);

    } catch
        (error) {
        console.error('Error creating shortened URL:', error);
        alert('An error occurred while creating the shortened URL. Please try again.');
    }
}

/**
 * Render the shortened URL, QRCode, and copy functionality
 * @param {string} originalUrl - Original URL
 * @param {string} shortenedUrl - Shortened URL
 * @param {string} dotColor - QRCode dot color
 * @param {string} backColor - QRCode background color
 * @param {any} QRCodeStyling - The QRCodeStyling module
 */
function renderShortenedResult(originalUrl, shortenedUrl, dotColor, backColor, QRCodeStyling) {
    let displayHTML = '';

    // If the URL contains non-ASCII characters, warn the user
    if (/[^\x00-\x7F]/.test(originalUrl)) {
        displayHTML += `
            <h2 class="warning-text">WARNING!!!</h2>
            <p class="warning-text center">Your URL contains non-ASCII characters. Please be careful!</p>
        `;
    }

    // Main content HTML
    displayHTML += `
        <a class="center home-page-small-link" href="${originalUrl}" target="_blank">${originalUrl}</a>
        <br />
        <div class="center">
            <svg class="center" xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px">
                <path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z"/>
            </svg>
        </div>
        <br />
        <div class="center home-page-big-link">
            <button id="copy-to-clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" height="35px" viewBox="0 -960 960 960" width="35px">
                    <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
                </svg>            
            </button>
            <a class="js-shortened-url" href="${shortenedUrl}" target="_blank">${shortenedUrl}</a>
        </div>
        <br />
        <div id="qrcode" class="center"></div>
        <div style="margin: 26px 0;"></div>
    `;

    // Place the content in the specified container
    const displayInfo = document.querySelector('.js-display-info');
    if (displayInfo) {
        displayInfo.innerHTML = displayHTML;
    }

    // Create and display the QRCode
    const qrcode = new QRCodeStyling({
        width: 2400,
        height: 2400,
        data: shortenedUrl,
        type: "canvas",
        image: "icon-QR.png",  // This is the optional center logo of the QR Code
        dotsOptions: {
            color: dotColor,
            type: "rounded"
        },
        backgroundOptions: {
            color: backColor
        },
    });

    const qrcodeContainer = document.getElementById('qrcode');
    if (qrcodeContainer) {
        qrcode.append(qrcodeContainer);
    }

    // Dealing with icon switching in dark/light mode
    handleThemeSwitchIcon();

    // Bind the "Copy to Clipboard" event
    const copyButton = document.querySelector('#copy-to-clipboard');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const copyText = document.querySelector('.js-shortened-url')?.textContent || '';
            if (!copyText) return;
            navigator.clipboard.writeText(copyText).then(() => {
                alert('Copied the text: ' + copyText);
            });
        });
    }
}

/**
 * Dynamically switch the theme icon based on the current mode (light / dark)
 * This part depends on external CSS or other mechanisms
 */
function handleThemeSwitchIcon() {
    const themeSwitch = document.querySelector('#theme-switch');
    if (!themeSwitch) return;

    const isDarkMode = document.body.classList.contains('darkmode');
    if (isDarkMode) {
        // SVG under the dark mode
        themeSwitch.innerHTML = `
            <!-- Uses empty SVG to fulfill the SVG switching mechanism of light and dark mode in CSS -->
            <svg></svg>
            <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/>
            </svg>
        `;
    } else {
        // SVG under the light mode
        themeSwitch.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/>
            </svg>
            <svg></svg>
        `;
    }
}
