<?php

// PURPOSE: Core plugin file that maintains version info, plugin slug info, coordinates loader, ...

// NOTES:   Implementation leverages WordPress by creating two custom post types, each of which
//				contains a specific set of custom fields. (Custom Field / AJAX-JSON data names)
//			TRACK:
//				pbs-id/id:			a unique ID for the track
//				pbs-title/title:	title to display for track
//				/abstract:			abstract for track (the_content)
//				pbs-url/url:		url to audio recording
//				length:				length of track in form HH:MM:SS.ms
//				trans:				url to transcript file
//			COLLECTION:
//				pbs-title/title:	title to display for track
//				/abstract:			text to display as abstract for collection (the_content)
//				pbs-icon/icon:		url to icon to display for collection
//				pbs-type/type:		'year', 'station', 'person', 'essay', or 'topic'
//				details:			url to text file to display for details
//				tracks:				cs list of track IDs

class Playback_Station {
	protected $loader;
	protected $plugin_slug;
	protected $version;

		// PURPOSE: Compare two IDs for sorting
	public function cmp_ids($a, $b)
	{
		return strcmp($a["id"], $b["id"]);
	} // cmp_ids()


		// PURPOSE: Compare two titles for sorting
	public function cmp_titles($a, $b)
	{
		return strcmp($a["title"], $b["title"]);
	} // cmp_titles()


		// PURPOSE:	Called by WP to modify output when viewing a page of any type
		// INPUT:	$page_template = default path to file to use for template to render page
		// RETURNS:	Modified $page_template setting (file path to new php template file)
	public function pbs_page_template($page_template)
	{
		global $post;

		$blog_id = get_current_blog_id();
		$ajax_url = get_admin_url($blog_id ,'admin-ajax.php');
		$post_type = get_query_var('post_type');

			// Ensure we're viewing a Collections page
	    if ($post_type == 'pbs-collection') {
	    		// Get rid of theme styles
			wp_dequeue_style('screen');
			wp_deregister_style('screen');
			wp_dequeue_style('events-manager');

			// wp_dequeue_script('site');
			// wp_deregister_script('site');

	    		// Load required styles
			wp_enqueue_style('font-awesome', plugins_url('lib/font-awesome/css/font-awesome.min.css', dirname(__FILE__)), '', $this->version );
			wp_enqueue_style('jquery-ui-css', plugins_url('lib/jquery-ui.css', dirname(__FILE__)), '', $this->version );
			wp_enqueue_style('jquery-ui-struct-css', plugins_url('lib/jquery-ui.structure.css', dirname(__FILE__)), 'jquery-ui-css', $this->version );
			wp_enqueue_style('jquery-ui-theme-css', plugins_url('lib/jquery-ui.theme.css', dirname(__FILE__)), 'jquery-ui-css', $this->version );
			wp_enqueue_style('pbs-css', plugins_url('playback-station.css', dirname(__FILE__)), 
				array('font-awesome', 'jquery-ui-css', 'jquery-ui-struct-css', 'jquery-ui-theme-css'), $this->version );

				// Load required JS libraries
			wp_enqueue_script('jquery');
			// wp_enqueue_script('modernizr');
			wp_enqueue_script('underscore');
			wp_enqueue_script('jquery-ui', plugins_url('lib/jquery-ui.min.js', dirname(__FILE__)), 'jquery');

			wp_enqueue_script('soundcloud-api', 'http://w.soundcloud.com/player/api.js');

				// Compile array of all tracks
			$tracks = array();
			$args = array('post_type' => 'pbs-track', 'posts_per_page' => -1);
			$loop = new WP_Query($args);
			while ($loop->have_posts()) : $loop->the_post();
				$track = array();
				$track_id = get_the_ID();

					// Get the custom field values
				$track["id"] = get_post_meta($track_id, "pbs-id", true);
				$track["title"] = get_post_meta($track_id, "pbs-title", true);
				$track["abstract"] = get_the_content();
				$track["url"] = get_post_meta($track_id, "pbs-url", true);
				$track["length"] = get_post_meta($track_id, "length", true);
				$track["trans"] = get_post_meta($track_id, "trans", true);
				array_push($tracks, $track);
			endwhile;
				// Sort by ID
			usort($tracks, array('Playback_Station', 'cmp_ids'));

				// Compile array of all collections
			$collections = array();
			$args = array('post_type' => 'pbs-collection', 'posts_per_page' => -1);
			$loop = new WP_Query($args);
			while ($loop->have_posts()) : $loop->the_post();
				$collection = array();
				$coll_id = get_the_ID();

					// Get the custom field values
				$coll_type = get_post_meta($coll_id, "pbs-type", true);
				$collection["title"] = get_post_meta($coll_id, "pbs-title", true);
				$collection["icon"] = get_post_meta($coll_id, "pbs-icon", true);
				$collection["abstract"] = get_the_content();
				$collection["details"] = get_post_meta($coll_id, "details", true);
				$collection["tracks"] = get_post_meta($coll_id, "tracks", true);

					// Find entry for collection type in array, or create it
				$found = false;
				$size = count($collections);
				for ($i = 0; $i < $size; $i++) {
					if ($collections[$i]["type"] == $coll_type) {
						array_push($collections[$i]["items"], $collection);
						$found = true;
						break;
					}
				}
				if (!$found) {
					$ct_entry = array();
					$ct_entry["type"] = $coll_type;
					$ct_entry["items"] = array($collection);
					array_push($collections, $ct_entry);
				}
			endwhile;
				// Sort each collection array by title
			for ($i=0; $i < count($collections); $i++) {
				usort($collections[$i]["items"], array('Playback_Station', 'cmp_titles'));
			}

				// Enqueue page JS last, after we've determine what dependencies might be
			wp_enqueue_script('pbs-script', plugins_url('playback-station.js', dirname(__FILE__)),
				array('jquery', 'underscore', 'jquery-ui'), $this->version);

				// Save variables in structure to pass to JavaScript code
			wp_localize_script('pbs-script', 'psData', array(
				'ajax_url'		=> $ajax_url,
				'tracks'		=> $tracks,
				'collections'	=> $collections
			) );

			$page_template = dirname(__FILE__).'/../single-pbs-collection.php';
			// $page_template = plugins_url('single-pbs-collection.php', dirname(__FILE__));
		}
		return $page_template;
	} // pbs_page_template()


	public function add_custom_post_types()
	{
        	// Register Custom Post Types
		$labels = array(
			'name' => _x('Tracks', 'post type general name'),
			'singular_name' => _x('Track', 'post type singular name'),
			'add_new' => _x('Add New', 'project'),
			'add_new_item' => __('Add New Track'),
			'edit_item' => __('Edit Track'),
			'new_item' => __('New Track'),
			'all_items' => __('Tracks'),
			'view_item' => __('View Track'),
			'search_items' => __('Search Tracks'),
			'not_found' =>  __('No tracks found'),
			'not_found_in_trash' => __('No tracks found in Trash'), 
			'parent_item_colon' => '',
			'menu_name' => __('Tracks')
		);
		$args = array(
			'labels' => $labels,
			'public' => true,
			'publicly_queryable' => true,
			'show_ui' => true, 
			'rewrite' => array('slug' => 'pbs-track', 'with_front' => FALSE),
			'capability_type' => 'page',
			'has_archive' => false,
			'hierarchical' => false,
			'menu_position' => null,
			/* if hierarchical, then may want to add 'page-attributes' to supports */
			'supports' => array('title', 'editor', 'thumbnail', 'revisions', 'custom-fields')
		); 
		register_post_type('pbs-track', $args);

		$labels = array(
			'name' => _x('Collections', 'post type general name'),
			'singular_name' => _x('Collection', 'post type singular name'),
			'add_new' => _x('Add New', 'collection'),
			'add_new_item' => __('Add New Collection'),
			'edit_item' => __('Edit Collection'),
			'new_item' => __('New Collection'),
			'all_items' => __('Collection'),
			'view_item' => __('View Collection'),
			'search_items' => __('Search Collections'),
			'not_found' =>  __('No collections found'),
			'not_found_in_trash' => __('No collections found in Trash'), 
			'parent_item_colon' => '',
			'menu_name' => __('Collections')
		);
		$args = array(
			'labels' => $labels,
			'public' => true,
			'publicly_queryable' => true,
			'show_ui' => true, 
			'rewrite' => array('slug' => 'pbs-collection', 'with_front' => FALSE),
			'capability_type' => 'page',
			'has_archive' => false,
			'hierarchical' => false,
			'menu_position' => null,
			/* if hierarchical, then may want to add 'page-attributes' to supports */
			'supports' => array('title', 'editor', 'thumbnail', 'revisions', 'custom-fields')
		);
		register_post_type('pbs-collection', $args);
	} // add_custom_post_types()


	public function __construct()
	{
		$this->plugin_slug = 'playback-station-slug';
		$this->version = '0.1.0';

        $this->load_dependencies();

		add_action('init', array('Playback_Station', 'add_custom_post_types'));

        $this->define_admin_hooks();
        $this->define_page_hooks();
	} // __construct()


		// PURPOSE: Force load of class files and create needed classes
	private function load_dependencies()
	{
			// Start with root directory for plugin
		require_once plugin_dir_path(dirname(__FILE__)).'admin/class-playback-station-admin.php';
			// Assumes that this file is in same directory as the loader
		require_once plugin_dir_path(__FILE__).'class-playback-station-loader.php';
		$this->loader = new Playback_Station_Loader();
	} // load_dependencies()


		// PURPOSE: Add hooks related to Dashboard
	private function define_admin_hooks()
	{
			// Add Dashboard hooks
		$admin = new Playback_Station_Admin($this->get_version());
		$this->loader->add_action('admin_enqueue_scripts', $admin, 'enqueue_styles');
		$this->loader->add_action('add_meta_boxes', $admin, 'add_meta_boxes');
		$this->loader->add_action('save_post', $admin, 'save_post');
	} // define_admin_hooks()


		// PURPOSE: Add hooks related to Page display
	private function define_page_hooks()
	{
		$this->loader->add_filter('single_template', $this, 'pbs_page_template');
	} // define_page_hooks()


	public function run()
	{
		$this->loader->run();
	} // run()


	public function get_version()
	{
		return $this->version;
	} // get_version()

} // class Playback_Station
