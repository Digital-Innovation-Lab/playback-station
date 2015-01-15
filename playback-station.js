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
//          Local user storage: CSV list of unique Track IDs (in sorted order) using key "pbs-tracks"

// TO DO:   Handle coming to end of track currently playing: automatically play next if from collection??

jQuery(document).ready(function($) {
		// access data compiled by plugin's PHP code
	var tracks = psData.tracks;
	var collections = psData.collections;

		// Current selection (indices and values); -1 = none
	var indexCollType, selCollType;
	var indexCollection=-1;
	var indexTrack=-1;
    // var selTrack='', selCollection='';

    	// For processing transcriptions
    var parseTimeCode 	= /(\d\d)\:(\d\d)\:(\d\d)\.(\d\d?)/;         // an exacting regular expression for parsing time
    var tcArray			= [];

    	// For playback of sound and transcription
    var rowIndex 		= -1;          // row of tcArray currently playing
    var playingNow 		= false;       // Audio currently playing
    var playWidget 		= null;        // SoundCloud widget object
    var playingCurated  = true;        // false if track in User Collection, true if in #track-table
    var numTracks       = 0;           // number of tracks in #track-table list

        // For User Collections -- array of Track IDs, kept in sorted order
    var pbsStorageKey   = 'pbs-user-collection';
    var userTracks      = [];


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
                    var transTable = $('#transcr-table');
                        // Should we synchronize audio and text transcript?
                    if (document.getElementById("transcSyncOn").checked) {
                        var topDiff = transTable.find('.transcr-timestamp[data-tcindex="'+index+'"]').offset().top -
                        				transTable.offset().top;
                        var scrollPos = transTable.scrollTop() + topDiff;
                        $('#tab-transcript').animate({ scrollTop: scrollPos }, 300);
                    }
                    if (rowIndex >= 0) {
	                	transTable.find('.transcr-timestamp[data-tcindex="'+rowIndex+'"]').removeClass('playing');                    	
                    }
	                transTable.find('.transcr-timestamp[data-tcindex="'+index+'"]').addClass('playing');
                    rowIndex = index;
                }
            }
            return match;
        });
    } // hightlightTranscriptLine()


        // PURPOSE: Bind code to handle seeking according to transcription selection
        // NOTES:   This is called by formatTranscript(), so only bound if a transcription exists
    function bindTranscrSeek()
    {
            // Allow user to click anywhere in player area; check if timecode, go to corresponding time
        $('#transcr-table').click(function(evt) {
            var clickTime = $(evt.target);
            if (playWidget && clickTime.hasClass('transcr-timestamp')) {
                var seekToTime = clickTime.data('timecode');
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
            // empty time code array -- each entry has start & end
        tcArray = [];
        rowIndex = -1;

            // split transcript text into array by line breaks
        var splitTranscript = new String(transcriptData);
        splitTranscript = splitTranscript.trim().split(/\r\n|\r|\n/g);
        // var splitTranscript = transcriptData.trim().split(/\r\n|\r|\n/g);       // More efficient but not working!

        if (splitTranscript) {
            var tcIndex = 0;
            var timeCode, lastCode=0, lastStamp=0;
            var textBlock='';
            _.each(splitTranscript, function(val) {
            		// Each entry is (1) empty/line break, (2) timestamp, or (3) text
                val = val.trim();
                    // Skip empty entries, which were line breaks
                if (val.length>1) {
                    	// Encountered timestamp -- compile previous material, if any
                    if (val.charAt(0) === '[' && (val.charAt(1) >= '0' && val.charAt(1) <= '9'))
                    {
                    	timeCode = tcToMilliSeconds(val);
                    	if (textBlock.length) {
                    			// Append timecode entry once range is defined
                    		if (lastStamp) {
                    			tcArray.push({ start: lastCode, end: timeCode });
                    		}
							$('#transcr-table').append('<div class="transcr-entry"><div class="transcr-timestamp" data-timecode="'+
                        		// timecode+'" data-tcindex="'+ tcIndex++ +'">'++'</div><div class="transcr-text">'+textBlock+'</div></div>');
                                lastCode+'" data-tcindex="'+tcIndex++ +'">'+lastStamp+'</div><div class="type-text">'+textBlock+'</div></div>')

							textBlock = '';
                    	}
                        lastStamp = val;
                        lastCode = timeCode;

                    	// Encountered textblock
                    } else {
                    	textBlock += val;
					}
				} // if length
            }); // _each
				// Handle any dangling text
			if (textBlock.length) {
					// Append very large number to ensure can't go past last item! 9 hours * 60 minutes * 60 seconds * 1000 milliseconds
				tcArray.push({ start: lastCode, end: 32400000 });
				$('#transcr-table').append('<div class="transcr-entry"><div class="transcr-timestamp" data-timecode="'+
					lastCode+'" data-tcindex="'+tcIndex+'">'+lastStamp+'</div><div class="transcr-text">'+textBlock+'</div></div>');
			}
        } // if (split)
    } // formatTranscript()


        // PURPOSE: Retrieve a particular collection by collection type and index into array
    function getCollByTypeAndIndex(type, index)
    {
        var collSet = _.find(collections, function(theCollType) {
            return theCollType.type === type;
        });
        if (collSet) {
            return collSet.items[index];
        } else
            return null;
    } // getCollByTypeAndIndex()


        // PURPOSE: Retrieve a particular track by id
        // TO DO:   Make more efficient by taking advantage of sorted track names
    function getTrackByID(trackID)
    {
        trackID = trackID.trim();
        return _.find(tracks, function(theTrack) {
            return trackID === theTrack.id;
        });
    } // getTrackByID()


		// PURPOSE: Refresh collections display given current collection type selection
        // ASSUMES: There is always some valid selection in selCollType
	function displayAllCollections()
	{
            // Empty list of collections
		$('#play-results').empty();

            // Find the entry for this collection type
		var collSet = _.find(collections, function(theCollType) {
			return theCollType.type === selCollType;
		});
        if (collSet) {
                // Add each collection to the list
            _.each(collSet.items, function(collEntry, collIndex) {
                var htmlEntry = '<div class="play-result" data-index="'+collIndex+'">'+collEntry.title+
                                '</div>';
                $('#play-results').append(htmlEntry);
            });
        }
	} // displayAllCollections()


		// PURPOSE: Refresh collection display given current collection selection
        // NOTES:   Each track has its unique ID in the data-id field
        //              the data-index simply has # in this list (not in original array)
	function displayACollection()
	{
        var topView = $('#main-top-view');
        var tabDetails = $('#tab-details');
        var trackTable = $('#track-table');

        topView.empty();
        tabDetails.empty();
        trackTable.empty();

        if (indexCollection >= 0) {
            var collEntry = getCollByTypeAndIndex(selCollType, indexCollection);

                // Display colletion details in the top box
            topView.append('<img class="album" src="'+collEntry.icon+'">');
            topView.append('<p><b>'+collEntry.title+'</b></p>');
            topView.append('<p>'+collEntry.abstract+'</p>');

                // Load collection details from file into #tab-details
            if (collEntry.details && collEntry.details !== '') {
                var xhr = new XMLHttpRequest();
                xhr.onload = function(e) {
                    tabDetails.append(xhr.responseText);
                }
                xhr.open('GET', collEntry.details, true);
                xhr.send();
            }

                // Display collection's list of tracks (in Tracks tab)
            var trackEntry, pos, html, checked;
            var trackList = collEntry.tracks.split(',');
            _.each(trackList, function(theTrackID, trackIndex) {
                trackEntry = getTrackByID(theTrackID);
                if (trackEntry) {
                        // Check to see if this track is in user collection, and check if so
                    if (userTracks.length) {
                        pos = _.sortedIndex(userTracks, theTrackID);
                        checked = userTracks[pos] === theTrackID ? 'fa-check-square-o' : 'fa-plus';
                    } else {
                        checked = 'fa-plus';
                    }
                    html = '<div class="track-entry" data-id="'+theTrackID+'" data-index="'+trackIndex+
                                    '"><div class="track-title"><i class="fa '+checked+'"></i> <i class="fa fa-play-circle"></i> '+
                                    trackEntry.title+'</div><div class="track-time"> '+trackEntry.length+
                                    ' </div><div class="track-credits">'+trackEntry.abstract+'</div>';
                    trackTable.append(html);
                } else {
                    console.log("Bad Collection track name: "+theTrackID);
                }
            });
            numTracks = trackList.length;
        } // if indexCollection
	} // displayACollection()


        // PURPOSE: Create new transcription and SoundCloud player for track
    function playATrack(trackEntry)
    {
            // Is there a transcript file?
        if (trackEntry.trans && trackEntry.trans !== '') {
            $('#track-transcript-title').text('Transcript for '+trackEntry.title);
                // Load and parse transcript file
            var xhr = new XMLHttpRequest();
            xhr.onload = function(e) {
                formatTranscript(xhr.responseText);
            }
            xhr.open('GET', trackEntry.trans, true);
            xhr.send();
        } else {
            $('#track-transcript-title').text('');
            tcArray = [];
        }

            // Is there a SoundCloud file?
        if (trackEntry.url && trackEntry.url !== '') {
            var footer = $('footer');
            footer.empty();
            footer.append('<iframe id="scWidget" class="player" width="100%" height="120" src="http://w.soundcloud.com/player/?url='+
                        trackEntry.url+'"></iframe>');
            playWidget = SC.Widget(document.getElementById('scWidget'));

            playWidget.bind(SC.Widget.Events.READY, function() {
                    // Select and highlight initial line of transcription
                rowIndex = 0;
                $('#transcr-table .transcr-timestamp[data-tcindex=0]').addClass('playing');

                playWidget.play();
                playWidget.bind(SC.Widget.Events.PLAY, function() {
                    playingNow = true;
                });
                playWidget.bind(SC.Widget.Events.PAUSE, function() {
                    playingNow = false;
                });

                playWidget.bind(SC.Widget.Events.PLAY_PROGRESS, function(params) {
                    if (playingNow && tcArray.length > 0) {
                        hightlightTranscriptLine(params.currentPosition);
                    }
                });

                playWidget.bind(SC.Widget.Events.FINISH, function() {
                    playingNow = false;

                        // Only advance through list for curated collections
                    if (playingCurated) {
                            // Only if not last track
                        if (indexTrack < (numTracks-1)) {
                                // Clear playing track class
                            $('#track-table .track-entry[data-index="'+indexTrack+'"]').removeClass('playing');
                            indexTrack++;
                            displayATrack();
                        }
                    }
                });
            });
        } // if trackEntry.url
    } // playATrack()


        // PURPOSE: Refresh track display given current track selection
        // NOTE:    indexTrack is the index on the current track list, not in the full tracks array
    function displayATrack()
    {
            // Empty out transcription table
        $('#transcr-table').empty();

        if (indexTrack >= 0) {
            var trackSel = $('.track-entry[data-index="'+indexTrack+'"]')
            trackSel.addClass('playing');

                // Get the track info
            var trackID = trackSel.data('id');
            var trackEntry = getTrackByID(trackID);

                // Can track be found?
            if (trackEntry) {
                playATrack(trackEntry);
            }
        }
    } // displayATrack()


        // PURPOSE: Display user collection in right sidebar
    function displayUserCollection()
    {
        var userCollection = $('#pbs-user-collection');
        var trackEntry, html;

        userCollection.empty();
        _.each(userTracks, function(trackID, theIndex) {
            trackEntry = getTrackByID(trackID);
            if (trackEntry) {
                html = '<p class="user-track" data-id="'+trackID+'" data-index="'+theIndex+
                    '"><i class="fa fa-trash"></i> <i class="fa fa-play-circle"></i> <span class="track-select-title">'+
                    trackEntry.title+'</span></p>';
                userCollection.append(html);
            } else {
                console.log("Bad User Collection track name: "+trackID);
            }
        });
    } // displayUserCollection()


		// PURPOSE: Bind code that handles selecting a collection type
	function bindSelectCollType()
	{
		$('.play-option').click(function(evt) {
			var selIndex = $(evt.target).data('index');
			selIndex = parseInt(selIndex);
            var selCType = $(evt.target).data('coll-type');
            if (selCType === 'search') {
                doSearch();

            } else {
    			if (selIndex != indexCollType) {
    					// Update visuals
    				$('.play-option').removeClass('selected');
    				$(evt.target).addClass('selected');
    					// Set selection variables
    				indexCollType = selIndex;
                    selCollType = selCType;

                        // Reset collection and track selections
                    indexCollection = -1;
                    indexTrack = -1;

    					// Show relevant collections of this type
    				displayAllCollections();
                        // Clear out specific collection info
                    displayACollection();
                }
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
					$('.play-result').removeClass('selected');
					$(evt.target).addClass('selected');
						// Set selection variables
					// selCollection = $(evt.target).text();
					indexCollection = selIndex;

						// Display all material about selected collection
                    displayACollection();
				}
			}
		});
	} // bindSelectCollection()


		// PURPOSE: Bind code that handles selecting a particular track in collection frame
	function bindSelectTrack()
	{
		$('#track-table').click(function(evt) {
            var target = $(evt.target);
			var trackSel = target.closest('.track-entry').first();
			if (trackSel) {
				var selIndex = trackSel.data('index');
				selIndex = parseInt(selIndex);

                    // Was the play button selected?
                if (target.hasClass('fa-play-circle')) {
                    if (selIndex != indexTrack) {
                            // Deselect any previous track that was playing
                        $('#track-table .track-entry').removeClass('playing');
                        $('#pbs-user-collection .track-select-title').removeClass('playing');
                            // Set selection variables
                        indexTrack = selIndex;
                        // selTrack = trackSel.data('id');
                        playingCurated = true;
                        // trackSel.addClass('playing');
                        displayATrack();
                    }
                } else if (target.hasClass('fa-plus')) {
                        // Change the + to checkbox!
                    target.removeClass('fa-plus');
                    target.addClass('fa-check-square-o');
                        // Update user tracks array
                    insertUserTrack(trackSel.data('id'));
                        // Update local storage
                    localStorage[pbsStorageKey] = userTracks.join(',');
                        // Recompute HTML
                    displayUserCollection();
                }
			}
		});
	} // bindSelectTrack()


        // PURPOSE: Actually perform search functions and display resulting track names
    function doSearch()
    {
        var searchTerm = $('#search-text').val();
        var searchTitles = $('#search-titles:checked').val();
        var searchAbstracts = $('#search-abstracts:checked').val();

        if (!searchTitles && !searchAbstracts) {
            return;
        }
            // Unhighlight and clear collection selection
        $('.play-result').removeClass('selected');
        $('#tab-details').empty();
        $('#main-top-view').empty().append('Search results in tracks');
        indexCollection=-1; // selCollection = '';

            // Clear out track listings and selection
        var trackTable = $('#track-table');
        trackTable.empty();
        indexTrack=-1; // selTrack = '';
        numTracks = 0;

            // Create busy cursor during search
        jQuery('body').addClass('waiting');
            // Return control to browser briefly to ensure cursor updated
        window.setTimeout(function() {
                // case insensitive matching
            var searchRE = new RegExp(searchTerm, 'i');
            var pos, checked, html;

                // Search through list of tracks
            _.each(tracks, function(trackEntry, trackIndex) {
                if ((searchTitles && trackEntry.title.match(searchRE)) ||
                    (searchAbstracts && trackEntry.abstract.match(searchRE)))
                {
                        // check to see if track is in User Collection
                    if (userTracks.length) {
                        pos = _.sortedIndex(userTracks, trackEntry.id);
                        checked = userTracks[pos] === trackEntry.id ? 'fa-check-square-o' : 'fa-plus';
                    } else {
                        checked = 'fa-plus';
                    }
                    html = '<div class="track-entry" data-id="'+trackEntry.id+'" data-index="'+ numTracks++ +
                                    '"><div class="track-title"><i class="fa '+checked+'"></i> <i class="fa fa-play-circle"></i> '+
                                    trackEntry.title+'</div><div class="track-time"> '+trackEntry.length+
                                    ' </div><div class="track-credits">'+trackEntry.abstract+'</div>';
                    trackTable.append(html);
                }
            });

            jQuery('body').removeClass('waiting');
        }, 100);
    } // doSearch()


        // PURPOSE: Bind code to handle search GUI elements on carriage return in edit box
        // NOTE:    Selection from Search button handled in bindSelectCollType
    function bindSearch()
    {
        $('#search-text').on('keydown',function(e) {
            if (e.keyCode === 13) {
                doSearch();
            }
        });
    } // bindSearch()


        // RETURNS: true if the browser supports local storage
    function supportsLocalStorage()
    {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    } // supportsLocalStorage()


        // PURPOSE: Parse list of tracks in user collection, put into userTracks[]
    function parseStoredTracks()
    {
        var trackList = localStorage.getItem(pbsStorageKey);
        if (trackList) {
                // split by comma
            userTracks = trackList.split(',');
        } else {
            userTracks = [];
        }
    } // parseStoredTracks()


        // PURPOSE: Insert trackID into the userTracks array in sorted order
        // NOTES:   Do not allow duplicates
    function insertUserTrack(trackID)
    {
        if (userTracks.length) {
            var pos = _.sortedIndex(userTracks, trackID);
            if (userTracks[pos] !== trackID) {
                userTracks.splice(pos, 0, trackID);
            }
        } else {
            userTracks.push(trackID);
        }
    } // insertUserTrack()


        // PURPOSE: Bind code to handle updating User collections
    function bindUserCollection()
    {
        if (supportsLocalStorage()) {
            parseStoredTracks();
            displayUserCollection();

                // Handle play button on User Collection track
            $('#pbs-user-collection').click(function(evt) {
                    // Was the play button selected?
                var target = $(evt.target);
                if (target.hasClass('fa-play-circle')) {
                        // Get trackID
                    var trackID = target.parent().data('id');
                    if (trackID) {
                        var trackEntry = getTrackByID(trackID);
                        if (trackEntry) {
                                // De-select any tracks from the collection list
                            $('.track-entry').removeClass('playing');
                            indexTrack=-1; // selTrack = '';
                            playingCurated = false;

                                // Add CSS style 'playing' to track currently playing
                                // find next sibling DIV of class track-select-title, add playing
                            target.parent().find('.track-select-title').addClass('playing');

                                // Empty out transcription table
                            $('#transcr-table').empty();
                            playATrack(trackEntry);
                        }
                    }
                } else if (target.hasClass('fa-trash')) {
                    var trackID = target.parent().data('id');
                    if (trackID) {
                        var trackEntry = getTrackByID(trackID);
                        if (trackEntry) {
                                // Remove in User Track array
                            var pos = _.sortedIndex(userTracks, trackID);
                            if (userTracks[pos] === trackID) {
                                userTracks.splice(pos, 1);
                            }
                                // Update local storage
                            localStorage[pbsStorageKey] = userTracks.join(',');
                                // If the current collection listing contains this, we must change icon to +
                            var collTrack = $('#track-table div.track-entry[data-id="'+trackID+'"] i.fa-check-square-o');
                            collTrack.removeClass('fa-check-square-o');
                            collTrack.addClass('fa-plus');
                                // Update HTML to remove this from User Collection
                            target.parent().remove();
                        }
                    }
                } // if trash
            }); // click in user collection
        } // if local storage
    } // bindUserCollection()


		// Initialize jQueryUI components
	$('#main-tabbed').tabs();
	$('.play-slider').slider();


    	// Select Stations collection type by default
    indexCollType = 0; selCollType = 'station';
    displayAllCollections();

    	// Bind code to handle UI components
    bindSelectCollType();
    bindSelectCollection();
    bindSelectTrack();
    bindSearch();
    bindUserCollection();
    bindTranscrSeek();
});
