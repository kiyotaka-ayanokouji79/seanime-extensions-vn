/// <reference path="./manga-provider.d.ts" />

class Provider {
  constructor() {
    this.mdRawApi = "https://api.mangadex.org";
    this.imgProxy = "https://images.weserv.nl/?url=";

    this.sources = {
      truyenqq: {
        name: "TruyenQQ",
        base: "https://truyenqqko.com",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://truyenqqko.com/"
        }
      },
      otakusan: {
        name: "Otakusan",
        base: "https://otakusic.com",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://otakusic.com/"
        }
      },
      moetruyen: {
        name: "MoeTruyen",
        base: "https://moetruyen.net",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://moetruyen.net/"
        }
      }
    };
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: true,
    };
  }

  async request(url, customHeaders = {}) {
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          ...customHeaders
        }
      });
      return res && res.ok ? await res.text() : null;
    } catch (e) {
      return null;
    }
  }

  async proxyRequest(targetUrl) {
    try {
      const proxyUrl = "https://corsproxy.io/?url=" + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl);
      return res && res.ok ? res : null;
    } catch (e) {
      return null;
    }
  }

  async search(opts) {
    const q = (opts && opts.query ? opts.query : "").trim();
    if (!q) return [];

    const tasks = [
      this.searchMangaDex(q),
      this.searchTruyenQQ(q),
      this.searchOtakusan(q),
      this.searchMoeTruyen(q)
    ];

    const settles = await Promise.allSettled(tasks);
    const combined = [];

    for (let i = 0; i < settles.length; i++) {
      const r = settles[i];
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        for (let j = 0; j < r.value.length; j++) {
          combined.push(r.value[j]);
        }
      }
    }

    return combined;
  }

  async searchMangaDex(q) {
    try {
      const targetUrl = this.mdRawApi + "/manga?title=" + encodeURIComponent(q) + "&limit=10&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
      const res = await this.proxyRequest(targetUrl);
      if (!res) return [];

      const json = await res.json();
      const list = json.data || [];
      const results = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const attr = item.attributes || {};
        let title = q;
        if (attr.title) {
          title = attr.title.vi || attr.title.en || attr.title["ja-ro"] || Object.values(attr.title)[0] || q;
        }

        let coverUrl = "";
        const rels = item.relationships || [];
        for (let j = 0; j < rels.length; j++) {
          if (rels[j].type === "cover_art" && rels[j].attributes && rels[j].attributes.fileName) {
            const rawCover = "https://uploads.mangadex.org/covers/" + item.id + "/" + rels[j].attributes.fileName + ".256.jpg";
            coverUrl = this.imgProxy + encodeURIComponent(rawCover);
            break;
          }
        }

        results.push({
          id: "mangadex::" + item.id,
          title: "[MangaDex] " + title,
          synonyms: (attr.altTitles || []).flatMap(x => Object.values(x || {})).filter(Boolean),
          year: attr.year ? Number(attr.year) : 0,
          image: coverUrl
        });
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  async searchTruyenQQ(q) {
    const src = this.sources.truyenqq;
    const html = await this.request(src.base + "/tim-kiem.html?q=" + encodeURIComponent(q), src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const list = [];
    $(".list_stories ul li, .story-item").each((_, el) => {
      const a = $(el).find(".story-title a, h3 a, .title_story a").first();
      const title = a.text().trim();
      const href = a.attr("href");
      const img = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";

      if (href && title) {
        list.push({
          id: "truyenqq::" + href.replace(src.base, ""),
          title: "[TruyenQQ] " + title,
          url: href.startsWith("http") ? href : src.base + href,
          image: img.startsWith("http") ? img : (src.base + img)
        });
      }
    });
    return list;
  }

  async searchOtakusan(q) {
    const src = this.sources.otakusan;
    const html = await this.request(src.base + "/Manga/Search?keyword=" + encodeURIComponent(q), src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const list = [];
    $(".manga-list .item, .list-story .row").each((_, el) => {
      const a = $(el).find("h3 a, .title a").first();
      const title = a.text().trim();
      const href = a.attr("href");
      const img = $(el).find("img").attr("src") || "";

      if (href && title) {
        list.push({
          id: "otakusan::" + href.replace(src.base, ""),
          title: "[OtakuSan] " + title,
          url: href.startsWith("http") ? href : src.base + href,
          image: img.startsWith("http") ? img : (src.base + img)
        });
      }
    });
    return list;
  }

  async searchMoeTruyen(q) {
    const src = this.sources.moetruyen;
    const html = await this.request(src.base + "/tim-kiem?q=" + encodeURIComponent(q), src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const list = [];
    $(".list-story .story-item, .thumb-item").each((_, el) => {
      const a = $(el).find(".title a, h3 a").first();
      const title = a.text().trim();
      const href = a.attr("href");
      const img = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";

      if (href && title) {
        list.push({
          id: "moetruyen::" + href.replace(src.base, ""),
          title: "[MoeTruyen] " + title,
          url: href.startsWith("http") ? href : src.base + href,
          image: img.startsWith("http") ? img : (src.base + img)
        });
      }
    });
    return list;
  }

  async findChapters(id) {
    const parts = id.split("::");
    const sourceKey = parts[0];
    const subId = parts[1];

    if (sourceKey === "mangadex") return this.chaptersMangaDex(subId);
    if (sourceKey === "truyenqq") return this.chaptersTruyenQQ(subId);
    if (sourceKey === "otakusan") return this.chaptersOtakusan(subId);
    if (sourceKey === "moetruyen") return this.chaptersMoeTruyen(subId);
    return [];
  }

  async chaptersMangaDex(mangaId) {
    const chapters = [];
    let offset = 0;

    try {
      for (let page = 0; page < 10; page++) {
        const targetUrl = this.mdRawApi + "/manga/" + encodeURIComponent(mangaId) + "/feed?translatedLanguage[]=vi&limit=100&offset=" + offset + "&order[chapter]=asc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
        const res = await this.proxyRequest(targetUrl);
        if (!res) break;

        const json = await res.json();
        const list = json.data || [];
        if (!list.length) break;

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const attr = item.attributes || {};
          if (!attr.chapter) continue;

          let groupName = "MangaDex";
          const rels = item.relationships || [];
          for (let j = 0; j < rels.length; j++) {
            if (rels[j].type === "scanlation_group" && rels[j].attributes && rels[j].attributes.name) {
              groupName = rels[j].attributes.name;
              break;
            }
          }

          chapters.push({
            id: "mangadex::" + item.id,
            url: "https://mangadex.org/chapter/" + item.id,
            title: attr.title ? "Ch. " + attr.chapter + " - " + attr.title : "Chapter " + attr.chapter,
            chapter: String(attr.chapter),
            index: 0,
            scanlator: String(groupName)
          });
        }

        if (list.length < 100) break;
        offset += list.length;
      }
      return this.sortChapters(chapters);
    } catch (e) {
      return [];
    }
  }

  async chaptersTruyenQQ(path) {
    const src = this.sources.truyenqq;
    const html = await this.request(src.base + path, src.headers);
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
          id: "truyenqq::" + href.replace(src.base, ""),
          url: href.startsWith("http") ? href : src.base + href,
          title: title || ("Chương " + chNum),
          chapter: chNum,
          index: i,
          scanlator: "TruyenQQ"
        });
      }
    });
    return this.sortChapters(chapters);
  }

  async chaptersOtakusan(path) {
    const src = this.sources.otakusan;
    const html = await this.request(src.base + path, src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const chapters = [];
    $(".chapter-list li, .list-chapters a").each((i, el) => {
      const a = el.name === "a" ? $(el) : $(el).find("a").first();
      const href = a.attr("href");
      const title = a.text().trim();

      if (href) {
        const match = title.match(/([\d\.]+)/);
        const chNum = match ? match[1] : String(i + 1);

        chapters.push({
          id: "otakusan::" + href.replace(src.base, ""),
          url: href.startsWith("http") ? href : src.base + href,
          title: title || ("Chapter " + chNum),
          chapter: chNum,
          index: i,
          scanlator: "Otakusan"
        });
      }
    });
    return this.sortChapters(chapters);
  }

  async chaptersMoeTruyen(path) {
    const src = this.sources.moetruyen;
    const html = await this.request(src.base + path, src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const chapters = [];
    $(".list-chapter li a, .chapter-list a").each((i, el) => {
      const a = $(el);
      const href = a.attr("href");
      const title = a.text().trim();

      if (href) {
        const match = title.match(/([\d\.]+)/);
        const chNum = match ? match[1] : String(i + 1);

        chapters.push({
          id: "moetruyen::" + href.replace(src.base, ""),
          url: href.startsWith("http") ? href : src.base + href,
          title: title || ("Chapter " + chNum),
          chapter: chNum,
          index: i,
          scanlator: "MoeTruyen"
        });
      }
    });
    return this.sortChapters(chapters);
  }

  sortChapters(chapters) {
    chapters.sort((a, b) => {
      const nA = parseFloat(a.chapter) || 0;
      const nB = parseFloat(b.chapter) || 0;
      return nA - nB;
    });
    for (let i = 0; i < chapters.length; i++) {
      chapters[i].index = i;
    }
    return chapters;
  }

  async findChapterPages(id) {
    const parts = id.split("::");
    const sourceKey = parts[0];
    const subId = parts[1];

    if (sourceKey === "mangadex") {
      try {
        const targetUrl = this.mdRawApi + "/at-home/server/" + encodeURIComponent(subId);
        const res = await this.proxyRequest(targetUrl);
        if (!res) return [];

        const json = await res.json();
        const baseUrl = json.baseUrl;
        const chapter = json.chapter;
        if (!baseUrl || !chapter || !chapter.data || !chapter.hash) return [];

        return chapter.data.map((file, i) => ({
          url: this.imgProxy + encodeURIComponent(baseUrl + "/data/" + chapter.hash + "/" + file),
          index: i,
          headers: {}
        }));
      } catch (e) {
        return [];
      }
    }

    const src = this.sources[sourceKey];
    if (!src) return [];

    const fullUrl = src.base + subId;
    const html = await this.request(fullUrl, src.headers);
    if (!html) return [];

    const $ = LoadDoc(html);
    const pages = [];
    const selectors = ".chapter_content img, .story-see-content img, .page-chapter img, .reading-detail img, #chapter-content img, .content_view_read img";

    $(selectors).each((i, el) => {
      const img = $(el);
      let link = img.attr("src") || img.attr("data-src") || img.attr("data-original") || img.attr("data-cdn") || "";
      link = link.trim();

      if (link && !link.includes("banner") && !link.includes("ads") && !link.includes("logo")) {
        if (link.startsWith("//")) link = "https:" + link;
        if (!link.startsWith("http")) link = src.base + link;

        pages.push({
          url: link,
          index: i,
          headers: {
            "Referer": src.base + "/",
            "User-Agent": src.headers["User-Agent"]
          }
        });
      }
    });

    return pages;
  }
}

var payload = new Provider();
