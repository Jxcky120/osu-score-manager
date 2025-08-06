const fs = require("fs");
const OsuDBParser = require("osu-db-parser");
const rosu = require('rosu-pp-js');

function get_background(beatmap_bytes) {
    let file = beatmap_bytes.toString("utf8");

    const lines = file.split("\n");
    let inEvents = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("[Events]")) {
            inEvents = true;
            continue;
        }

        if (inEvents) {
            // Match something like: 0,0,"background.jpg",0,0
            const match = trimmed.match(/^\d+,\d+,"(.+?)"/);
            if (match) {
                return match[1]; // Return the background filename
            }
        }
    }

    return null;
}

process.on('message', (osu_path) => {
    try {
        let scoreBuffer = fs.readFileSync(osu_path + "/scores.db");
        const scoreDB = new OsuDBParser(null, null, scoreBuffer);
        let scoresDBData = scoreDB.getScoreData();

        let osuDBBuffer = fs.readFileSync(osu_path + "/osu!.db");
        const osuDB = new OsuDBParser(osuDBBuffer);
        let osuDBData = osuDB.getOsuDBData();

        let beatmaps = osuDBData.beatmaps.map(beatmap => ({
            artist: beatmap.artist_name,
            song_title: beatmap.song_title,
            creator_name: beatmap.creator_name,
            difficulty: beatmap.difficulty,
            osu_file_name: beatmap.osu_file_name,
            folder_name: beatmap.folder_name,
            beatmap_hash: beatmap.md5,
            circle_size: beatmap.circle_size,
        }));

        let scores = scoresDBData.scorebeatmaps.flatMap(scores => {
            let beatmap = beatmaps.find(beatmap => beatmap.beatmap_hash === scores.hash);
            if (!beatmap) {
                return scores.scores.flatMap(score => {
                    score.maxPP = 0;
                    score.currentPP = 0;
                    score.background_path = "./no_bg.png";
                    return score;
                });
            }
            const correct_folder_name = Buffer.from(beatmap.folder_name, "latin1").toString("utf8");

            return scores.scores.flatMap(score => {
                if(score.mode != 0) return [];
                const correct_osu_file_name = Buffer.from(beatmap.osu_file_name, "latin1").toString("utf8");

                let beatmap_path = osu_path + "/Songs/" + correct_folder_name + "/" + correct_osu_file_name;
                const beatmapBytes = fs.readFileSync(beatmap_path);

                let map = new rosu.Beatmap(beatmapBytes);

                let calculator = new rosu.Performance({
                    mods: score.mods,
                    lazer: false,
                });

                const maxPP = calculator.calculate(map);

                const currentPP = new rosu.Performance({
                    n100: score.amount100,
                    n50: score.amount50,
                    misses: score.amountMisses,
                    combo: score.maxcombo,
                    mods: score.mods,
                    lazer: false,
                }).calculate(maxPP);

                score.maxPP = maxPP.pp;
                score.currentPP = currentPP.pp;
                score.bpm = map.bpm;
                score.map_max_combo = maxPP.difficulty.maxCombo;

                score.background_path = osu_path + "/Songs/" + correct_folder_name + "/" + get_background(beatmapBytes);
                score.beatmap = {
                    approach_rate: maxPP.difficulty.ar,
                    // circle_size: maxPP.difficulty.cs,
                    hp_drain: maxPP.difficulty.hp,
                    overall_difficulty: maxPP.difficulty.od,
                    ... beatmap
                }

                score.star_rating = maxPP.difficulty.stars;

                map.free();
                calculator.free();

                return score;
            });
        });

        process.send({ status: 'success', data: scores });
    } catch (error) {
        process.send({ status: 'error', message: error.message });
    }
});
