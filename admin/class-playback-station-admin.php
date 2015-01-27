<?php

// PURPOSE: Code that handles admin Dashboard functionality and Options page

class Playback_Station_Admin {

	private $version;

	private $options;

	public function __construct( $version )
	{
		$this->version = $version;
	} // __construct()


	public function enqueue_styles()
	{
        wp_enqueue_style('playback-station-admin-css', plugins_url('admin/css/playback-station-admin.css', dirname(__FILE__)),
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
<p>Unique ID for Track <input type="text" name="pbs-id" id="pbs-id" size="16" value="<?php echo $pbs_id; ?>"> </p>
<p>Title for Track <input type="text" name="pbs-title" id="pbs-title" size="48" value="<?php echo $pbs_title; ?>"> </p>
<p>URL to audio recording <input type="text" name="pbs-url" id="pbs-url" size="48" value="<?php echo $pbs_url; ?>"> </p>
<p>Length of Track <input type="text" name="pbs-length" id="pbs-length" size="11" placeholder="HH:MM:SS.ms" value="<?php echo $length; ?>"> </p>
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
<p>Title for Collection <input type="text" name="pbs-title" id="pbs-title" size="32" value="<?php echo $pbs_title; ?>"> </p>
<p>URL to icon <input type="text" name="pbs-icon" id="pbs-icon" size="48" value="<?php echo $pbs_icon; ?>"> </p>
<p>Collection type <select name="pbs-type" id="pbs-type">
<?php
		// Get setting for collection type definitions
	$coll_settings = get_option('pbs_base_options');
	$coll_settings = $coll_settings['pbs_coll_types'];
		// Seperate each definition and process elements
	$coll_defs = explode (",", $coll_settings);
	foreach ($coll_defs as $the_def) {
		$def_elements = explode("|", $the_def);
		$def_elements[0] = trim($def_elements[0]);
		$def_elements[1] = trim($def_elements[1]);
		printf('<option value="'.$def_elements[0].'"');
		if (isset($pbs_type))
			selected($pbs_type, $def_elements[0]);
		printf('>'.$def_elements[1].'</option>');
	}
?>
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

		// PURPOSE: Ensure that txt and png files are able to be added to the Media Library
	public function add_mime_types($mime_types)
	{
	    $mime_types['txt'] = 'text/plain';
	    $mime_types['csv'] = 'text/csv';

	    return $mime_types;
	} // add_mime_types()


		// PURPOSE: Handle Options for Playback Station
	public function admin_menu()
    {
        // This page will be under "Settings"
        add_options_page(
            'Playback Admin',
            'Playback Settings',
            'manage_options', 
            'pbs-settings-admin',
            array( $this, 'create_admin_page' )
        );
    } // admin_menu()


		// PURPOSE: Options page callback
    public function create_admin_page()
    {
        // Set class property
        $this->options = get_option('pbs_base_options');
        ?>
        <div class="wrap">
            <h2>Playback Station Settings</h2>
            <form method="post" action="options.php">
            <?php
                // This prints out all hidden setting fields
                settings_fields('pbs_option_group');
                do_settings_sections('pbs-settings-admin');
                submit_button();
            ?>
            </form>
        </div>
        <?php
    } // create_admin_page()


		// PURPOSE: Register and add settings
    public function admin_init()
    {
        	// To save options in DB
        register_setting(
            'pbs_option_group', // Option group
            'pbs_base_options', // Option name
            array( $this, 'sanitize' ) // Sanitize
        );

    		// To show settings on Options page
        add_settings_section(
            'pbs_settings', // ID
            'Playback Customization Settings', // Title
            array( $this, 'print_section_info' ), // Callback
            'pbs-settings-admin' // Page
        );

        add_settings_field(
            'pbs_prefix', // ID
            'User Storage Key', // Title
            array( $this, 'pbs_prefix_callback' ), // Callback
            'pbs-settings-admin', // Page
            'pbs_settings' // Section
        );

        add_settings_field(
            'pbs_coll_types',
            'Collection Types',
            array( $this, 'pbs_coll_types_callback' ),
            'pbs-settings-admin',
            'pbs_settings'
        );
    } // admin_init()


    	// PURPOSE: Sanitize each setting field as needed
    	// INPUT:   $input = all settings fields as array keys
    public function sanitize( $input )
    {
        $new_input = array();

        if (isset($input['pbs_prefix']))
            $new_input['pbs_prefix'] = sanitize_text_field($input['pbs_prefix']);
        if (isset($input['pbs_coll_types']))
            $new_input['pbs_coll_types'] = sanitize_text_field($input['pbs_coll_types']);

        return $new_input;
    } // sanitize()


    	// PURPOSE: Print the Section text
    public function print_section_info()
    {
        echo '<p>Customize Playback Station on this website with these settings</p>';
    }

		// PURPOSE: Get the settings option array and print one of its values
    public function pbs_prefix_callback()
    {
        printf(
            '<input type="text" id="pbs_prefix" name="pbs_base_options[pbs_prefix]" value="%s" />',
            isset( $this->options['pbs_prefix'] ) ? esc_attr( $this->options['pbs_prefix']) : ''
        );
    } // pbs_prefix_callback()

    	// PURPOSE: Get the settings option array and print one of its values
    public function pbs_coll_types_callback()
    {
        printf(
            '<input type="text" id="pbs_coll_types" name="pbs_base_options[pbs_coll_types]" value="%s" size="48" />',
            isset( $this->options['pbs_coll_types'] ) ? esc_attr( $this->options['pbs_coll_types']) : ''
        );
    } // pbs_coll_types_callback()

} // class Playback_Station_Admin
