import { listKamera, listInsiden } from "$lib/server/novira/index.js"; 
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
    return { 
        kameraList: await listKamera(),
        insidenList: await listInsiden() 
    };
};