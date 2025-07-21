const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

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

        // 👇 Nuevo: revisa href="mailto:…"
        const emailsFromMailto = [];
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href');
            const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
            if (email) emailsFromMailto.push(email);
        });

        const allEmails = Array.from(new Set([
            ...emailsFromText,
            ...emailsFromMailto
        ]));

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

app.listen(PORT, () => {
    console.log(`✅ Email scraper listening on port ${PORT}`);
});
