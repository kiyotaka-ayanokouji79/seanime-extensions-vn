/// <reference path="./manga-provider.d.ts" />

class Provider {
  constructor() {
    this.baseUrl = "https://truyenqqko.com";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async request(url) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": this.baseUrl + "/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
      });
      return res && res.ok ? await res.text() : null;
    } catch (e) {
      return null;
    }
  }

  async search(opts) {
    const q = (opts && opts.query ? opts.query : "").trim();
    if (!q) return [];

    try {
      const searchUrl = this.baseUrl + "/tim-kiem.html?q=" + encodeURIComponent(q);
      const html = await this.request(searchUrl);
      if (!html) return [];

      const $ = LoadDoc(html);
      const results = [];

      $(".list_stories ul li, .story-item").each((_, el) => {
        const item = $(el);
        const a = item.find(".story-title a, h3 a, .title_story a").first();
        const title = a.text().trim();
        const href = a.attr("href");
        const img = item.find("img").attr("src") || item.find("img").attr("data-src") || "";

        if (href && title) {
          results.push({
            id: href.replace(this.baseUrl, ""),
            title: title,
            url: href.startsWith("http") ? href : this.baseUrl + href,
            image: img.startsWith("http") ? img : (this.baseUrl + img)
          });
        }
      });

      return results;
    } catch (err) {
      return [];
    }
  }

  async findChapters(mangaPath) {
    try {
      const fullUrl = mangaPath.startsWith("http") ? mangaPath : (this.baseUrl + mangaPath);
      const html = await this.request(fullUrl);
      if (!html) return [];

      const $ = LoadDoc(html);
      const chapters = [];

      $(".works-chapter-list .item, .list_chapter .row").each((i, el) => {
        const a = $(el).find("a").first();
        const href = a.attr("href");
        const title = a.text().trim();

        if (href) {
          const match = title.match(/Chương\s+([\d\.]+)/i) || title.match(/Chapter\s+([\d\.]+)/i);
          const chNum = match ? match[1] : String(i + 1);

          chapters.push({
            id: href.replace(this.baseUrl, ""),
            url: href.startsWith("http") ? href : this.baseUrl + href,
            title: title || ("Chương " + chNum),
            chapter: chNum,
            index: i
          });
        }
      });

      chapters.sort((a, b) => {
        const nA = parseFloat(a.chapter) || 0;
        const nB = parseFloat(b.chapter) || 0;
        return nA - nB;
      });

      for (let i = 0; i < chapters.length; i++) {
        chapters[i].index = i;
      }

      return chapters;
    } catch (err) {
      return [];
    }
  }

  async findChapterPages(chapterPath) {
    try {
      const fullUrl = chapterPath.startsWith("http") ? chapterPath : (this.baseUrl + chapterPath);
      const html = await this.request(fullUrl);
      if (!html) return [];

      const $ = LoadDoc(html);
      const pages = [];

      $(".chapter_content img, .story-see-content img, .page-chapter img").each((i, el) => {
        const img = $(el);
        let src = img.attr("src") || img.attr("data-src") || img.attr("data-original") || img.attr("data-cdn") || "";

        if (src && !src.includes("banner") && !src.includes("ads")) {
          if (src.startsWith("//")) src = "https:" + src;

          pages.push({
            url: src,
            index: i,
            headers: {
              "Referer": this.baseUrl + "/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          });
        }
      });

      return pages;
    } catch (err) {
      return [];
    }
  }
}