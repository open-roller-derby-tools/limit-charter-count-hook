let SafeError = Error;

try {
    const path = '/app/code/node_modules/@directus/errors/dist/index.js';
    const errors = await import(path);

    // 1. Use createError to define a class with OUR custom code.
    // This ensures the Title translation works (errors.INVALID_CHARTER).
    if (errors.createError) {
        SafeError = errors.createError('INVALID_CHARTER', 'Charter Limit Reached', 400);
    } else {
        console.error("[HOOK] createError not found.");
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
                    let rawLang = user.language;
                    if (rawLang.includes('-')) {
                        lang = rawLang.split('-')[0];
                    } else {
                        lang = rawLang;
                    }
                }
            } catch (e) {}
        }

        let template = translations[lang] || translations['en'];
        return template.replace('{limit}', limit);
    }

    // Helper to throw the error with the correct message
    async function throwLimitError(userId, limit) {
        const message = await getErrorMessage(userId, limit);
        // We create the error instance
        const error = new SafeError();
        // We overwrite the message property with our specific translated string
        error.message = message;
        throw error;
    }

    filter('items.create', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_skater_id;
        if (!charterId) return;

        await database('charter').where('id', charterId).forUpdate().first();

        const limit = await getDynamicLimit();
        const result = await database('team_members').count('* as count').where('charter_skater_id', charterId).first();

        if (result.count >= limit) {
            await throwLimitError(accountability?.user, limit);
        }
    });

    filter('items.update', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_skater_id;
        if (!charterId) return;

        await database('charter').where('id', charterId).forUpdate().first();

        const limit = await getDynamicLimit();
        const result = await database('team_members').count('* as count').where('charter_skater_id', charterId).first();

        if (result.count >= limit) {
            await throwLimitError(accountability?.user, limit);
        }
    });
};
