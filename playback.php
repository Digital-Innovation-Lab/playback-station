<?php
/*
 * Plugin Name:       Playback Station
 * Plugin URI:        
 * Description:       Plays collections of audio recordings indexed in various ways
 * Version:           0.1.0
 * Author:            Michael Newton, Digital Innovation Lab, UNC-CH
 * Author URI:        
 * Text Domain:       dil-playback-station
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Domain Path:       /languages
 */

// PURPOSE: Registers the plugin with WordPress and sets everything in motion

require_once plugin_dir_path(__FILE__).'includes/class-playback-station.php';

function run_playback_station()
{ 
    $pbs = new Playback_Station();
    $pbs->run(); 
} // run_playback_station()
 
run_playback_station();
