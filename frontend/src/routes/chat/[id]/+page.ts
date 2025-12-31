/**
 * Chat page load function
 * Validates conversation ID and returns it for the page
 */

import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { id } = params;

	// Validate that ID looks like a UUID
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	if (!id || !uuidPattern.test(id)) {
		throw error(404, {
			message: 'Invalid conversation ID'
		});
	}

	// TODO: In the future, load conversation from IndexedDB here
	// For now, just return the ID and let the page component handle state

	return {
		conversationId: id
	};
};
