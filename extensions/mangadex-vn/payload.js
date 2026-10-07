/// <reference path="./manga-provider.d.ts" />

class Provider {
  constructor() {
    this.api = "https://api.mangadex.org";
    this.proxy = "https://corsproxy.io/?url=";
    this.imgProxy = "https://images.weserv.nl/?url=";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: true,
    };
  }

  async fetchApi(url) {
    // 1. Thử gọi trực tiếp trước (nếu người dùng đang bật VPN)
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36"
        }
      });
      if (res && res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Bỏ qua lỗi và chuyển sang fallback proxy
    }

    // 2. Fallback qua proxy nếu bị nhà mạng chặn
    try {
      const proxyUrl = this.proxy + encodeURIComponent(url);
      const res = await fetch(proxyUrl);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  async search(opts) {
    const q = (opts && opts.query ? opts.query : "").trim();
    if (!q) return [];

    try {
      const endpoint = `${this.api}/manga?title=${encodeURIComponent(q)}&limit=25&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
      const json = await this.fetchApi(endpoint);
      if (!json || !json.data) return [];

      const results = [];
      const list = json.data;

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
            coverUrl = `${this.imgProxy}${encodeURIComponent(`https://uploads.mangadex.org/covers/${item.id}/${rels[j].attributes.fileName}.256.jpg`)}`;
            break;
          }
        }

        results.push({
          id: String(item.id),
          title: String(title),
          synonyms: (attr.altTitles || []).flatMap(x => Object.values(x || {})).filter(Boolean),
          year: attr.year ? Number(attr.year) : 0,
          image: coverUrl
        });
      }

      return results;
    } catch (err) {
      return [];
    }
  }

  async findChapters(id) {
    const chapters = [];
    let offset = 0;

    try {
      // Lấy tối đa 500 chapter dịch tiếng Việt (vi)
      for (let page = 0; page < 5; page++) {
        const endpoint = `${this.api}/manga/${encodeURIComponent(id)}/feed?translatedLanguage[]=vi&limit=100&offset=${offset}&order[chapter]=asc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
        const json = await this.fetchApi(endpoint);

        if (!json || !json.data || json.data.length === 0) break;
        const list = json.data;

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const attr = item.attributes || {};

          // Lấy tên nhóm dịch nếu có
          let scanlator = "MangaDex";
          const rels = item.relationships || [];
          for (let j = 0; j < rels.length; j++) {
            if (rels[j].type === "scanlation_group" && rels[j].attributes && rels[j].attributes.name) {
              scanlator = rels[j].attributes.name;
              break;
            }
          }

          // Trường chapter bắt buộc phải có giá trị
          const chNumber = attr.chapter !== undefined && attr.chapter !== null ? String(attr.chapter) : String(chapters.length + 1);

          chapters.push({
            id: String(item.id),
            url: `https://mangadex.org/chapter/${item.id}`,
            title: attr.title ? `Ch. ${chNumber} - ${attr.title}` : `Chapter ${chNumber}`,
            chapter: chNumber,
            index: chapters.length,
            scanlator: String(scanlator)
          });
        }

        if (list.length < 100) break;
        offset += list.length;
      }

      // Sắp xếp tăng dần theo số thứ tự chapter
      chapters.sort((a, b) => {
        const numA = parseFloat(a.chapter) || 0;
        const numB = parseFloat(b.chapter) || 0;
        return numA - numB;
      });

      for (let i = 0; i < chapters.length; i++) {
        chapters[i].index = i;
      }

      return chapters;
    } catch (err) {
      return [];
    }
  }

  async findChapterPages(chapterId) {
    try {
      const endpoint = `${this.api}/at-home/server/${encodeURIComponent(chapterId)}`;
      const json = await this.fetchApi(endpoint);

      if (!json || !json.baseUrl || !json.chapter || !json.chapter.data || !json.chapter.hash) {
        return [];
      }

      const baseUrl = json.baseUrl;
      const hash = json.chapter.hash;
      const files = json.chapter.data;

      return files.map((fileName, idx) => {
        const directUrl = `${baseUrl}/data/${hash}/${fileName}`;
        return {
          url: `${this.imgProxy}${encodeURIComponent(directUrl)}`,
          index: idx,
          headers: {
            "Referer": "https://mangadex.org/"
          }
        };
      });
    } catch (err) {
      return [];
    }
  }
}
