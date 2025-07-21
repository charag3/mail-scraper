const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/scrape-email', async (req, res) => {
    const { url } = req.body;

    console.log('📥 Request body:', req.body);

    if (!url) {
        console.log('⚠️ No URL provided');
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        console.log(`🌐 Scraping URL: ${url}`);

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const text = $('body').text();
        const emailsFromText = extractEmails(text);

        const emailsFromMailto = [];
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href');
            const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
            if (email) emailsFromMailto.push(email);
        });

        let allEmails = Array.from(new Set([
            ...emailsFromText,
            ...emailsFromMailto
        ]));

        // 👉 Si no encontró ningún email, intenta en Facebook
        if (allEmails.length === 0) {
            console.log('🔍 No email on site. Checking Facebook link...');
            const fbLink = findFacebookLink($);
            if (fbLink) {
                console.log(`🔗 Found Facebook link: ${fbLink}`);
                const fbEmail = await scrapeFacebook(fbLink);
                if (fbEmail) {
                    allEmails.push(fbEmail);
                }
            }
        }

        console.log(`📧 Found emails: ${allEmails}`);

        return res.json({
            success: true,
            email: allEmails[0] || null,
            all_emails: allEmails
        });
    } catch (err) {
        console.error(`❌ Error scraping ${url}: ${err.message}`);
        return res.json({
            success: false,
            email: null,
            all_emails: [],
            error: err.message
        });
    }
});

function extractEmails(text) {
    const regex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches)) : [];
}

function findFacebookLink($) {
    let fbLink = null;
    $('a[href*="facebook.com"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('facebook.com')) {
            fbLink = href.split('?')[0]; // limpia parámetros extra
            return false; // rompe el loop
        }
    });
    return fbLink;
}

async function scrapeFacebook(fbUrl) {
    console.log(`🧭 Scraping Facebook page: ${fbUrl}`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(fbUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        const text = await page.evaluate(() => document.body.innerText);
        const emails = extractEmails(text);
        await browser.close();
        if (emails.length > 0) {
            console.log(`📧 Found email on Facebook: ${emails[0]}`);
            return emails[0];
        }
        console.log('🔍 No email found on Facebook.');
        return null;
    } catch (err) {
        console.error(`❌ Error scraping Facebook: ${err.message}`);
        await browser.close();
        return null;
    }
}

app.listen(PORT, () => {
    console.log(`✅ Email scraper with FB fallback listening on port ${PORT}`);
});
