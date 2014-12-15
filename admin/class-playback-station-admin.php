<?php

// PURPOSE: Code that handles admin Dashboard functionality

class Playback_Station_Admin {

	private $version;

	public function __construct( $version )
	{
		$this->version = $version;
	} // __construct()


	public function enqueue_styles()
	{
        wp_enqueue_style('playback-station-admin-css', plugin_dir_url( __FILE__ ) . 'css/class-playback-station-admin.css',
            array(), $this->version, FALSE);
	} // enqueue_styles()


	public function add_meta_boxes()
	{
		add_meta_box('playback-station-track-admin', 'Track Data',
            array($this, 'render_track_meta_boxes'), 'pbs-track', 'normal', 'core');
		add_meta_box('playback-station-coll-admin', 'Collection Data',
            array($this, 'render_collection_meta_boxes'), 'pbs-collection', 'normal', 'core');
	} // add_meta_boxes()


		// PURPOSE: Insert custom field data into Dashbox metaboxes for pbs-track CPT
	public function render_track_meta_boxes($post)
	{
			// Add nonce field so we can verify later
		wp_nonce_field('pbs_nonce_box', 'pbs_nonce_box_nonce');

			// Get custom field values
		$pbs_id = get_post_meta($post->ID, 'pbs-id', true);
		$pbs_title = get_post_meta($post->ID, 'pbs-title', true);
		$pbs_url = get_post_meta($post->ID, 'pbs-url', true);
		$length = get_post_meta($post->ID, 'length', true);
		$trans = get_post_meta($post->ID, 'trans', true);
			// Create HTML for metaboxes
?>
<p>Unique ID for track <input type="text" name="pbs-id" id="pbs-id" size="16" value="<?php echo $pbs_id; ?>"> </p>
<p>Title for track <input type="text" name="pbs-title" id="pbs-title" size="48" value="<?php echo $pbs_title; ?>"> </p>
<p>URL to audio recording <input type="text" name="pbs-url" id="pbs-url" size="48" value="<?php echo $pbs_url; ?>"> </p>
<p>Length of track <input type="text" name="pbs-length" id="pbs-length" size="11" placeholder="HH:MM:SS.ms" value="<?php echo $length; ?>"> </p>
<p>URL to transcript <input type="text" name="pbs-trans" id="pbs-trans" size="48" value="<?php echo $trans; ?>"> </p>
<?php
	} // render_track_meta_boxes()


		// PURPOSE: Insert custom field data into Dashbox metaboxes for pbs-collection CPT
	public function render_collection_meta_boxes($post)
	{
			// Add nonce field so we can verify later
		wp_nonce_field('pbs_nonce_box', 'pbs_nonce_box_nonce');

			// Get custom field values
		$pbs_title = get_post_meta($post->ID, 'pbs-title', true);
		$pbs_icon = get_post_meta($post->ID, 'pbs-icon', true);
		$pbs_type = get_post_meta($post->ID, 'pbs-type', true);
		$details = get_post_meta($post->ID, 'details', true);
		$tracks = get_post_meta($post->ID, 'tracks', true);
			// Create HTML for metaboxes
?>
<p>Title for collection <input type="text" name="pbs-title" id="pbs-title" size="32" value="<?php echo $pbs_title; ?>"> </p>
<p>URL to icon <input type="text" name="pbs-icon" id="pbs-icon" size="48" value="<?php echo $pbs_icon; ?>"> </p>
<p>Collection type <select name="pbs-type" id="pbs-type">
	<option value="year" <?php if (isset($pbs_type)) selected($pbs_type, 'year'); ?>>Year</option>
	<option value="station" <?php if (isset($pbs_type)) selected($pbs_type, 'station'); ?>>Station</option>
	<option value="person" <?php if (isset($pbs_type)) selected($pbs_type, 'person'); ?>>Person</option>
	<option value="essay" <?php if (isset($pbs_type)) selected($pbs_type, 'essay'); ?>>Essay</option>
	<option value="topic" <?php if (isset($pbs_type)) selected($pbs_type, 'topic'); ?>>Topic</option>
</select></p>
<p>URL to "details" file <input type="text" name="pbs-details" id="pbs-details" size="48" value="<?php echo $details; ?>"> </p>
<p>Track list (comma-separated list) <input type="text" name="pbs-tracks" id="pbs-tracks" size="56" value="<?php echo $tracks; ?>"> </p>
<?php
	} // render_collection_meta_boxes()


    	// PURPOSE: Save the custom fields as inserted by render_meta_box above
    public function save_post($post_id)
    {
			// Verify nonce is set
		if (!isset($_POST['pbs_nonce_box_nonce']))
			return $post_id;
		$nonce = $_POST['pbs_nonce_box_nonce'];

			// Verify the nonce is valid
		if (!wp_verify_nonce($nonce, 'pbs_nonce_box'))
			return $post_id;

		// If autosave, form not been submitted, we don't want to do anything.
		if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)
			return $post_id;

			// Check the user's permissions.
		if (!current_user_can('edit_page', $post_id))
			return $post_id;

			// Save track custom fields?
		if ($_POST['post_type'] == 'pbs-track') {
				// For each value, check if sent, sanitize and save it
			if (isset($_POST['pbs-id'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-id']);
				update_post_meta($post_id, 'pbs-id', $pbs_id);
			}
			if (isset($_POST['pbs-title'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-title']);
				update_post_meta($post_id, 'pbs-title', $pbs_id);
			}
			if (isset($_POST['pbs-url'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-url']);
				update_post_meta($post_id, 'pbs-url', $pbs_id);
			}
			if (isset($_POST['pbs-length'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-length']);
				update_post_meta($post_id, 'length', $pbs_id);
			}
			if (isset($_POST['pbs-trans'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-trans']);
				update_post_meta($post_id, 'trans', $pbs_id);
			}

			// Save collection custom fields?
		} else if ($_POST['post_type'] == 'pbs-collection') {
				// For each value, check if sent, sanitize and save it
			if (isset($_POST['pbs-title'])) {
				$pbs_id = sanitize_text_field($_POST['pbs-title']);
				update_post_meta($post_id, 'pbs-title', $pbs_id);
			}
			if (isset($_POST['pbs-icon'])) {
				$pbs_icon = sanitize_text_field($_POST['pbs-icon']);
				update_post_meta($post_id, 'pbs-icon', $pbs_icon);
			}
			if (isset($_POST['pbs-type'])) {
				$pbs_type = $_POST['pbs-type'];
				update_post_meta($post_id, 'pbs-type', $pbs_type);
			}
			if (isset($_POST['pbs-details'])) {
				$pbs_details = sanitize_text_field($_POST['pbs-details']);
				update_post_meta($post_id, 'details', $pbs_details);
			}
			if (isset($_POST['pbs-tracks'])) {
				$pbs_tracks = sanitize_text_field($_POST['pbs-tracks']);
				update_post_meta($post_id, 'tracks', $pbs_tracks);
			}
		}
    } // save_post()

} // class Playback_Station_Admin
