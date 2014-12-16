// ====================================================================
// Playback-Station: WordPress plugin for playing curated audio tracks
// Project of University of North Carolina, Digital Innovation Lab

// USES JS LIBS: Underscore, jQuery, jQueryUI, Font Awesome, SoundCloud

// ASSUMES: php code has created HTML DOM framework -- we need only insert relevant materials
// NOTES: 	psData global variable created by PHP code to pass
//				tracks: 		Array of all track objects, sorted by ID
//				collections: 	Array of all collection objects
//					type: 		String
//						items: 	Array of collections of this type sorted by title

// TO DO:   Insert SoundCloud controls into DOM
//          Add "Update" button to user collection area for un-selecting tracks?
//          Handle coming to end of track currently playing: automatically play next if from collection
//          Handle all user selections

jQuery(document).ready(function($) {
		// access data compiled by plugin's PHP code
	var tracks = psData.tracks;
	var collections = psData.collections;

		// Current selection (indices and values)
	var indexCollType, selCollType;
	var indexCollection, selCollection;
	var indexTrack, selTrack;

    	// For processing transcriptions
    var parseTimeCode 	= /(\d\d)\:(\d\d)\:(\d\d)\.(\d\d?)/;         // an exacting regular expression for parsing time
    var tcArray			= [];

    	// For playback
    var rowIndex 		= -1;
    var playingNow 		= false;
    var primeAudio 		= true;
    var playWidget 		= null;


        // PURPOSE: Given a millisecond reading, unhighlight any previous "playhead" and highlight new one
        //			Called by playback widget monitor
    function hightlightTranscriptLine(millisecond)
    {
        var match;

        _.find(tcArray, function(tcEntry, index) {
            match = (tcEntry.start <= millisecond && millisecond <= tcEntry.end);
            if (match) {
            		// Only change if this row not already highlighted
                if (rowIndex != index) {
                        // Should we synchronize audio and text transcript?
                    if (document.getElementById("transcSyncOn").checked) {
                        var topDiff = $('#transcr-table .transcr-timestamp[data-tcindex="'+index+'"]').offset().top -
                        				$('#transcr-table').offset().top;
                        var scrollPos = $('#transcr-table').scrollTop() + topDiff;
                        $('#transcr-table').animate({ scrollTop: scrollPos }, 300);
                    }
                    if (rowIndex >= 0) {
	                	$('#transcr-table .transcr-timestamp[data-tcindex="'+rowIndex+'"]').removeClass('playing');                    	
                    }
	                $('#transcr-table .transcr-timestamp[data-tcindex="'+index+'"]').addClass('playing');
                    rowIndex = index;
                }
            }
            return match;
        });
    } // hightlightTranscriptLine()


        // PURPOSE: Bind code to handle play, seek, close, etc.
    function bindPlayerHandlers()
    {
			// Setup audio/transcript SoundCloud player after entire sound clip loaded
        playWidget.bind(SC.Widget.Events.READY, function() {
				// Prime the audio -- must initially play (seekTo won't work until sound loaded and playing)
			playWidget.play();
			playWidget.bind(SC.Widget.Events.PLAY, function() {
				dhpWidget.playingNow = true;
			});
			playWidget.bind(SC.Widget.Events.PAUSE, function() {
				dhpWidget.playingNow = false;
			});

			playWidget.bind(SC.Widget.Events.PLAY_PROGRESS, function(params) {
					// Pauses audio after it primes so seekTo will work properly
				if (dhpWidget.primeAudio) {
					playWidget.pause();
					primeAudio = false;
					playingNow = false;
				}
				if (playingNow && tcArray.length > 0) {
					hightlightTranscriptLine(params.currentPosition);
				}
			});
				// Can't seek within the SEEK event because it causes infinite recursion
            playWidget.bind(SC.Widget.Events.FINISH, function() {
                playingNow = false;
            });
        });
    } // bindPlayerHandlers()


        // PURPOSE: Bind code to handle seeking according to transcription selection
        // NOTES:   This is called by formatTranscript(), so only bound if a transcription exists
    function bindTranscrSeek()
    {
            // Allow user to click anywhere in player area; check if timecode, go to corresponding time
        $('#transcr-table').click(function(evt) {
            if ($(evt.target).hasClass('transcr-timestamp') && playWidget) {
            	var tcElement = $(evt.target).closest('.transcr-timestamp');
                var seekToTime = $(tcElement).data('timecode');
                    // seekTo doesn't work unless sound is already playing
                if (!playingNow) {
                    playingNow = true;
                    playWidget.play();
                }
                playWidget.seekTo(seekToTime);
            }
        });
    } // bindTranscrSeek()


        // PURPOSE: Convert timecode string into # of milliseconds
        // INPUT:   timecode must be in format [HH:MM:SS] or [HH:MM:SS.ss]
        // ASSUMES: timecode in correct format, parseTimeCode contains compiled RegEx
    function tcToMilliSeconds(timecode)
    {
        var milliSecondsCode = new Number();
        var matchResults;

        matchResults = parseTimeCode.exec(timecode);
        if (matchResults !== null) {
            // console.log("Parsed " + matchResults[1] + ":" + matchResults[2] + ":" + matchResults[3]);
            milliSecondsCode = (parseInt(matchResults[1])*3600 + parseInt(matchResults[2])*60 + parseFloat(matchResults[3])) * 1000;
                // The multiplier to use for last digits depends on if it is 1 or 2 digits long
            if (matchResults[4].length == 1) {
                milliSecondsCode += parseInt(matchResults[4])*100;
            } else {
                milliSecondsCode += parseInt(matchResults[4])*10;
            }
        } else {
        	reportError(false, "Error in transcript file: Cannot parse " + timecode + " as timecode.");
            throw new Error("Error in transcript file: Cannot parse " + timecode + " as timecode.");
            milliSecondsCode = 0;
        }
        return milliSecondsCode;
    } // tcToMilliSeconds()


        // PURPOSE: Insert HTML and compile array from transcript
        // INPUT:   transcriptData = quicktime text format: timestamps on separate lines, [HH:MM:SS.m]
    function formatTranscript(transcriptData)
	{
			// Remove whatever transcript currently exists
    	$('#transcr-table').empty();
            // empty time code array -- each entry has start & end
        tcArray = [];
        rowIndex = -1;

            // split transcript text into array by line breaks
        var splitTranscript = new String(transcriptData);
        splitTranscript = splitTranscript.trim().split(/\r\n|\r|\n/g);
        // var splitTranscript = transcriptData.trim().split(/\r\n|\r|\n/g);       // More efficient but not working!

        if (splitTranscript) {
            var timecode, lastStamp=0;
            var tcIndex=0;
            var textBlock='';
            _.each(splitTranscript, function(val) {
            		// Each entry is (1) empty/line break, (2) timestamp, or (3) text
                val = val.trim();
                    // Skip empty entries, which were line breaks
                if (val.length>1) {
                    	// Encountered timestamp -- compile previous material, if any
                    if (val.charAt(0) == '[') {
                    	timecode = tcToMilliSeconds(val);
                    	if (textBlock.length) {
                    			// Append timecode entry once range is defined
                    		if (lastStamp) {
                    			tcArray.push({ start: lastStamp, end: timecode });
                    		}
							$('#transcr-table').append('<div class="transcr-entry"><div class="transcr-timestamp" data-timecode="'+
                        		timecode+'" data-tcindex="'+ tcIndex++ +'"></div><div class="transcr-text">'+textBlock+'</div></div>');
							textBlock = '';
                    	}
                    	lastStamp = timecode;

                    	// Encountered textblock
                    } else {
                    	textBlock += val;
					}
				} // if length
            }); // _each
				// Handle any dangling text
			if (textBlock.length) {
					// Append very large number to ensure can't go past last item! 9 hours * 60 minutes * 60 seconds * 1000 milliseconds
				tcArray.push({ start: lastStamp, end: 32400000 });
				$('#transcr-table').append('<div class="transcr-entry"><div class="transcr-timestamp" data-timecode="'+
					lastStamp+'" data-tcindex="'+tcIndex+'"></div><div class="transcr-text">'+textBlock+'</div></div>');
			}
        } // if (split)
    } // formatTranscript()


		// PURPOSE: Display list of collections given current collection type selection
	function displayAllCollections()
	{
            // Empty list of collections
		$('#play-results').empty();

		var collType = _.find(collections, function(theCollType) {
			return theCollType.type === selCollType;
		});
	} // displayAllCollections()


		// PURPOSE: Display all materials relating to current collection selection
	function displayACollection()
	{
            // Empty list of tracks (in Tracks tab)
		$('#track-table').empty();

            // TO DO: Show icon for collection
            // TO DO: Display title & abstract for collection
            // TO DO: List all tracks in collection
            // TO DO: Load abstract into Details tab contents
	} // displayACollection()


		// PURPOSE: Bind code that handles selecting a collection type
	function bindSelectCollType()
	{
		$('.play-option').click(function(evt) {
			var selIndex = $(evt.target).data('index');
			selIndex = parseInt(selIndex);
			if (selIndex != indexCollType) {
					// Update visuals
				$('.play-option').removeClass('selected');
				$(evt.target).addClass('selected');
					// Set selection variables
				selCollType = $(evt.target).text().trim();
				indexCollType = selIndex;

                    // TO DO: Clear out track listings
                    // TO DO: Clear out current selected collection window
                    // TO DO: Clear out Details tab contents
                    // TO DO: Clear out Transcript tab contents

					// Show relevant collection materials
				displayAllCollections();
			}
		});
	} // bindSelectCollType()


		// PURPOSE: Bind code that handles selecting a particular collection
	function bindSelectCollection()
	{
		$('#play-results').click(function(evt) {
			if ($(evt.target).hasClass('play-result')) {
				var selIndex = $(evt.target).data('index');
				selIndex = parseInt(selIndex);
				if (selIndex != indexCollection) {
						// Update visuals
					$('.play-option[data-index="'+selIndex+'"]').removeClass('selected');
					$(evt.target).addClass('selected');
						// Set selection variables
					selCollection = $(evt.target).text();
					indexCollection = selIndex;
                    // TO DO: Clear out track listings
                    // TO DO: Clear out current selected collection window
                    // TO DO: Clear out Details tab contents
                    // TO DO: Clear out Transcript tab contents

						// Display all material about selected collection
                    displayACollection();
				}
			}
		});
	} // bindSelectCollection()


		// PURPOSE: Bind code that handles selecting a particular track
	function bindSelectTrack()
	{
		$('#track-table').click(function(evt) {
			var trackSel = $(evt.target).closest('.track-entry').first();
			if (trackSel) {
				var selIndex = $(trackSel).data('index');
				selIndex = parseInt(selIndex);
				if (selIndex != indexTrack) {
						// Update visuals
					$('.play-option[data-index="'+selIndex+'"]').removeClass('playing');
					$(evt.target).addClass('playing');
						// Set selection variables
					indexTrack = selIndex;
						// TO DO: Set SoundCloud to play
                        // TO DO: Clear out Transcript tab contents
                        // TO DO: Load track transcript into Transcript tab contents
				}
			}
		});
	} // bindSelectTrack()


		// PURPOSE: Bind code to handle playback widget controls
	function bindSelectPlayer()
	{

	} // bindSelectPlayer()


        // PURPOSE: Bind code to handle searches
    function bindSearch()
    {

    } // bindSearch()


        // PURPOSE: Bind code to handle User collections
    function bindUserCollection()
    {

    } // bindUserCollection()


		// Initialize jQueryUI components
	$( "#main-tabbed" ).tabs();
	$(".play-slider").slider();


    	// Select collection type by default
    indexCollType = 0;
    displayAllCollections();

    	// Bind code to handle UI components
    bindSelectCollType();
    bindSelectCollection();
    bindSelectTrack();
    bindSelectPlayer();
    bindSearch();
    bindTranscrSeek();
});
