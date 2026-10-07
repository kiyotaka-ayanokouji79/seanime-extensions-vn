/// <reference path="./manga-provider.d.ts" />

class Provider {
  constructor() {
    this.rawApi = "https://api.mangadex.org";
    this.imgProxy = "https://images.weserv.nl/?url=";
  }

  getSettings() {
    return {
      supportsMultiLanguage: true,
      supportsMultiScanlator: true,
    };
  }

  async request(targetUrl, headers = {}) {
    try {
      const proxyUrl = "https://corsproxy.io/?url=" + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          ...headers
        }
      });
      return res && res.ok ? res : null;
    } catch (e) {
      return null;
    }
  }

  async search(opts) {
    const q = (opts && opts.query ? opts.query : "").trim();
    if (!q) return [];

    try {
      const targetUrl = this.rawApi + "/manga?title=" + encodeURIComponent(q) + "&limit=20&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
      const res = await this.request(targetUrl);
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
          id: String(item.id),
          title: String(title),
          synonyms: (attr.altTitles || []).flatMap(x => Object.values(x || {})).filter(Boolean),
          year: attr.year ? Number(attr.year) : 0,
          image: coverUrl || ""
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
      for (let page = 0; page < 10; page++) {
        const targetUrl = this.rawApi + "/manga/" + encodeURIComponent(id) + "/feed?translatedLanguage[]=vi&limit=100&offset=" + offset + "&order[chapter]=asc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";
        const res = await this.request(targetUrl);
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
            id: String(item.id),
            url: "https://mangadex.org/chapter/" + item.id,
            title: attr.title ? "Ch. " + attr.chapter + " - " + attr.title : "Chapter " + attr.chapter,
            chapter: String(attr.chapter),
            index: 0,
            language: "vi",
            scanlator: String(groupName)
          });
        }

        if (list.length < 100) break;
        offset += list.length;
      }

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

  async findChapterPages(chapterId) {
    try {
      const targetUrl = this.rawApi + "/at-home/server/" + encodeURIComponent(chapterId);
      const res = await this.request(targetUrl);
      if (!res) return [];

      const json = await res.json();
      const baseUrl = json.baseUrl;
      const chapter = json.chapter;
      if (!baseUrl || !chapter || !chapter.data || !chapter.hash) return [];

      return chapter.data.map((file, i) => {
        const rawPageUrl = baseUrl + "/data/" + chapter.hash + "/" + file;
        return {
          url: this.imgProxy + encodeURIComponent(rawPageUrl),
          index: i,
          headers: {}
        };
      });
    } catch (err) {
      return [];
    }
  }
}