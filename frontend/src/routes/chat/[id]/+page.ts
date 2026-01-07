/**
 * Chat page load function
 * Validates conversation ID and returns it for the page
 */

import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
	const { id } = params;

	// Validate that ID looks like a UUID
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	if (!id || !uuidPattern.test(id)) {
		throw error(404, {
			message: 'Invalid conversation ID'
		});
	}

	// Extract firstMessage query param (for new chats from project page)
	const firstMessage = url.searchParams.get('firstMessage') || null;

	return {
		conversationId: id,
		firstMessage
	};
};
