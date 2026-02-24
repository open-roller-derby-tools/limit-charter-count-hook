let SafeError = Error;

try {
    const path = '/app/code/node_modules/@directus/errors/dist/index.js';
    const errors = await import(path);
    const BaseError = errors.InvalidPayloadError;

    if (BaseError) {
        class CharterError extends BaseError {
            constructor(message) {
                super(message);
                this.message = message; 
                this.extensions = { code: 'INVALID_CHARTER' };
            }
        }
        SafeError = CharterError;
    }
} catch (e) {
    console.error("[HOOK] Failed to load Directus errors.", e.message);
}

export default ({ filter }, context) => {
    const { database: systemDb } = context || {};

    const translations = {
        en: "The charter can not have more than {limit} players.",
        fr: "Le charter ne peut pas avoir plus de {limit} joueureuses.",
        es: "Este charter no puede tener más de {limit} jugadores."
    };

    async function getDynamicLimit() {
        try {
            const result = await systemDb('options').first('charter_max_count');
            return result?.charter_max_count || 20;
        } catch (e) {
            return 20;
        }
    }

    async function getErrorMessage(userId, limit) {
        let lang = 'en';
        
        if (userId) {
            try {
                const user = await systemDb('directus_users').select('language').where('id', userId).first();
                if (user?.language) {
                    // 1. Get the raw language (e.g., "fr-FR")
                    let rawLang = user.language;
                    
                    // 2. Normalize: Convert "fr-FR" -> "fr"
                    if (rawLang.includes('-')) {
                        lang = rawLang.split('-')[0];
                    } else {
                        lang = rawLang;
                    }
                }
            } catch (e) {
                console.warn("[HOOK] Could not fetch user language", e.message);
            }
        }

        // 3. Check if we have a translation for this key, otherwise fallback to 'en'
        let template = translations[lang] || translations['en'];
        return template.replace('{limit}', limit);
    }

    filter('items.create', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_skater_id;
        if (!charterId) return;

        // Lock to prevent race conditions
        await database('charter').where('id', charterId).forUpdate().first();

        const limit = await getDynamicLimit();
        const result = await database('team_members').count('* as count').where('charter_skater_id', charterId).first();

        if (result.count >= limit) {
            throw new SafeError(await getErrorMessage(accountability?.user, limit));
        }
    });

    filter('items.update', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_skater_id;
        if (!charterId) return;

        // Lock to prevent race conditions
        await database('charter').where('id', charterId).forUpdate().first();

        const limit = await getDynamicLimit();
        const result = await database('team_members').count('* as count').where('charter_skater_id', charterId).first();

        if (result.count >= limit) {
            throw new SafeError(await getErrorMessage(accountability?.user, limit));
        }
    });
};
