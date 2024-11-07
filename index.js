import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import { chromium } from "playwright";

const csvWriter = createObjectCsvWriter;

// Set up CSV writer
const csvFilePath = path.join(process.cwd(), 'new_tokopedia_reviews.csv');
const csv = csvWriter({
  path: csvFilePath,
  header: [
    { id: 'reviewerName', title: 'Reviewer Name' },
    { id: 'rating', title: 'Rating' },
    { id: 'reviewText', title: 'Review Text' }
  ],
  append: true // Allows appending data on subsequent runs
});

// Fungsi untuk menggulir halaman ke bawah
const scrollToBottom = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

// Fungsi utama untuk scraping
const app = async () => {
  const browser = await chromium.launch({ headless: false, ignoreHTTPSErrors: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.110 Safari/537.36"
  });
  const page = await context.newPage();

  try {
    // Masukkan URL produk Tokopedia yang ingin di-scrape
    await page.goto("https://www.tokopedia.com/eatsambel/sambal-pedas-cumi-ciamik-sambal-rumahan-sambal-enak/review", {
      waitUntil: "domcontentloaded",
    });

    // Scroll ke bawah untuk memuat semua komentar
    await scrollToBottom(page);
    await page.waitForTimeout(2000); // Tunggu sejenak agar komentar benar-benar dimuat

  // Initialize the CSV file with headers (if file doesn't already exist)
  if (!fs.existsSync(csvFilePath)) {
    await csv.writeRecords([]); // Write headers only
  }
  // Loop through pages 1 to 50
  for (let i = 1; i <= 50; i++) {
    console.log(`Scraping page ${i}...`);

    await page.waitForSelector('#review-feed', { timeout: 10000 });

    const reviews = await page.$$eval('#review-feed article', (articles) => {
      return articles.map(article => {
        const ratingElement = article.querySelector('[aria-label^="bintang"]');
        const reviewText = article.querySelector('span[data-testid="lblItemUlasan"]')?.textContent.replace(/\n/g, '').trim() || 'No review text';
        const reviewerName = article.querySelector('.name')?.textContent.trim() || 'Anonymous';
        const rating = ratingElement ? ratingElement.getAttribute('aria-label') : 'No rating';

        return { reviewerName, rating, reviewText };
      });
    });

    // Write scraped data to CSV
    await csv.writeRecords(reviews);
    console.log(`Page ${i} reviews saved to CSV.`);
    // Click the next page button if it exists
    const nextPageButton = await page.$(`button[aria-label="Laman ${i + 1}"]`);
    if (nextPageButton) {
      await nextPageButton.click();
      await page.waitForTimeout(500); // Wait for the page transition
    } else {
      console.log('No more pages found or pagination limit reached.');
      break;
    }
  }

  } catch (error) {
    console.error("An error occurred:", error.message);
  } finally {
    await page.close();
    await browser.close();
  }
};

app();

