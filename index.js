export default ({ filter }, context) => {
    const { database: db } = context || {};

    // Define a custom error class that Directus will recognize
    class CharterLimitError extends Error {
        constructor(message) {
            super(message);
            this.name = 'CharterLimitError';
            // This sets the code inside the error overlay
            this.extensions = { code: 'INVALID_CHARTER' }; 
        }
    }

// We probably need to move this to Directus > Settings > Translation
    const translations = {
        en: "This charter has reached the limit of {limit} skaters.",
        fr: "Cette charter a atteint la limite de {limit} joueureuses.",
        es: "Este charter ha alcanzado el límite de {limit} jugadores."
    };

    async function getDynamicLimit(database) {
        try {
            const result = await database('options').first('charter_max_count');
            return result?.charter_max_count || 20;
        } catch (e) {
            console.warn("Could not fetch charter_max_count, using default 20.");
            return 20;
        }
    }

    async function getErrorMessage(userId, limit) {
        let lang = 'en';
        if (userId) {
            try {
                const user = await db('directus_users').select('language').where('id', userId).first();
                if (user?.language) lang = user.language;
            } catch (e) {}
        }
        let template = translations[lang] || translations['en'];
        return template.replace('{limit}', limit);
    }

    filter('items.create', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_id;
        if (!charterId) return;

        const limit = await getDynamicLimit(database);
        const result = await database('team_members').count('* as count').where('charter_id', charterId).first();

        if (result.count >= limit) {
            throw new CharterLimitError(await getErrorMessage(accountability?.user, limit));
        }
    });

    filter('items.update', async (payload, { collection }, { database, accountability }) => {
        if (collection !== 'team_members') return;
        const charterId = payload.charter_id;
        if (charterId === undefined || charterId === null) return;

        const limit = await getDynamicLimit(database);
        const result = await database('team_members').count('* as count').where('charter_id', charterId).first();

        if (result.count >= limit) {
            throw new CharterLimitError(await getErrorMessage(accountability?.user, limit));
        }
    });
};
