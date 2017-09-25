function timeLineCrop(){
    var outerWidth = MAX_WIDTH,
        outerHeight = MAX_HEIGHT,
        margin = {top: 30, right: 15, bottom: 30, left: 15},
        width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;


    var x;
    var svg;
    var rangeButtonsHeight = 30;
    var timelineDim = {};
    var partyStepWidth = 15;
    var drawingType = 'uncluttered'; // or cluttered || uncluttered
    var pixelPercentageToParties = 0.5;

    var ranges;
    var years;

    function chart(selection) {
        selection.each(function (data) {
            timelineDim.height = height-15 -rangeButtonsHeight;//*0.7;

            svg = d3.select(this)
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", "0 0 " + outerWidth + " " + outerHeight)
                .classed("timeline-crop", true);

            appendGreyRangeButtons(data.type + "s", data.id,0);
            setPartiesTraces(10+rangeButtonsHeight+10);

        })
    }

    function appendGreyRangeButtons(type, data, y ){
        ranges = CONGRESS_DEFINE[type][data];
        years = $.map( d3.range(ranges.period[0].getFullYear(), ranges.period[1].getFullYear()+1),
                            function(d){
                                return {name:d, period:[new Date(d,0,1), new Date(d+1,0,1)] };
                            });

        x = d3.time.scale()
            .domain([ranges.period[0], ranges.period[1]])
            .rangeRound([margin.left, width -margin.right]);

        var gRects = appendRangeButtons(years, y,'foreground years');

    }

    function appendRangeButtons(years, y, fillClass){

        var gb = svg.append('g').attr('transform','translate('+margin.left+','+y+')');

        var gRects = gb.selectAll('g')
            .data(years)
            .enter().append("g");


        gRects.append('rect')
            .attr({
                height:rangeButtonsHeight,
                y:3,
                x:function (d) { return x(d.period[0])},
                width:function (d) { return x(d.period[1]) - x(d.period[0])},
                'class': fillClass,
                stroke: 'white',
                'stroke-width': 3
            });

        gRects.append('text')
            .text( function(d){return d.name} )
            .attr({
                y:25,
                x:  function(d){return  x(d.period[0])+ (x(d.period[1]) - x(d.period[0]))/2   },
                fill:"#fff",
                'font-size': function(d) { return Math.log((x(d.period[1]) - x(d.period[0])) / this.getComputedTextLength()*9 )*5 + "px"; },
                //'font-size': 13,
            }).attr("text-anchor", "middle");

        return gRects;
    }

    function scaleX_middleOfBiennial(year) {
        return x(new Date(year,12));
    }

    function setPartiesTraces(y){
        var traceMargin = 5;
        var partyTraces = svg.append('g').attr({id:'partyTraces',transform:'translate('+margin.left+','+(y+traceMargin)+')'});

        // Add the traced (stroke-dasharray) lines from top to bottom
        var yearlyColumms = partyTraces.append('g');
        var firstYear = ranges.period[0].getFullYear();
        var lastYear = ranges.period[1].getFullYear();

        d3.range(firstYear,lastYear).forEach(function(year){
                yearlyColumms.append('path').attr({
                    d: 'M '+scaleX_middleOfBiennial(year)+' '+2+' V '+(timelineDim.height+10),
                    stroke:'grey',
                    'stroke-dasharray':"10,10"
                })
        });
        yearlyColumms.append('path').attr({
            d: 'M '+scaleX_middleOfBiennial(firstYear-1)+' '+timelineDim.height/2+' H '+scaleX_middleOfBiennial(lastYear),
            stroke:'lightgrey',
            'stroke-dasharray':"5,5"
        });

        // governemnt X opposition
        var gg = partyTraces.append('g').style('text-anchor','middle');
        gg.append('text')
            .text('YEARLY POLITICAL SPECTRA')
            .attr({
                'class':"partiesLabel",
                x:scaleX_middleOfBiennial(firstYear-1) +scaleX_middleOfBiennial(firstYear)/2 -20,
                y: timelineDim.height/2 +5
            });

        partyTraces.append('g').attr('class','parties').attr({transform:'translate(0,'+traceMargin+')'});
        drawParties();
    }

    function drawParties(){
        calcPartiesStepsUncluttered(timelineDim.height,pixelPercentageToParties);
        calcPartiesStepsCluttered(timelineDim.height,pixelPercentageToParties);
        forceAlgorithmToAproximateTheUnclutteredPositionsToClutteredWithoutOcclusion(timelineDim.height);
        // CALC TRACES
        var parties = d3.entries(CONGRESS_DEFINE.partiesTraces1by1.traces);

        parties.forEach( function(party){
            var partyAtYear = party.value;
            party.traces = [];
            d3.range(1991,2017,1).forEach(function(year) {
                if( (partyAtYear[year] !== undefined) && (partyAtYear[year+1] !== undefined) ){
                    party.traces.push({first:partyAtYear[year],second:partyAtYear[year+1],firstDate:year,secondDate:year+1});
                }
            });
        });

        var partiesG = svg.select('g.parties')
            .selectAll('.party')
            .data( parties, function(d){ return d.key} );

        partiesG.enter().append('g').attr({'class':'party'})
            .on('mouseover',function(d){ var p={}; p[d.key] = true; chart.partiesMouseover(p); })
            .on('mouseout',chart.partiesMouseout);


        partiesG.exit().transition().attr('opacity',0).remove();

        drawPartiesSteps(drawingType);
        //drawPartiesTraces(drawingType);
    }

    function calcPartiesStepsUncluttered(height,pixelPercentageToParties){
        // ------------------------------------------------------------
        // get parties for each period (biennial)
        periods = {};

        // for each year starting from first year
        for (var i = 1991; i < 2017; i++ ) {
            // for each period create an array of parties
            periods[i] = { parties:[] };
            for( party in CONGRESS_DEFINE.partiesTraces1by1.traces){
                // if the party did not exist(undefined) - do not push in the party array
                if(CONGRESS_DEFINE.partiesTraces1by1.traces[party][i] !== undefined){
                    CONGRESS_DEFINE.partiesTraces1by1.traces[party][i].party = party; //(garbage)
                    periods[i].parties.push( CONGRESS_DEFINE.partiesTraces1by1.traces[party][i] );
                }
            }
        }

        console.log(periods);

        // for each period
        for( var period in periods){
            var partiesInPeriod = periods[period].parties;

            // sort parties by their 1D spectrum[1]
            partiesInPeriod.sort(function(a, b) {
                return (b.center[1]+1) - (a.center[1]+1);
            });

            // calc the distance between adjacent parties in the 1D
            var distances = [];
            // sum of distances
            var sumDistances = 0;
            // sum deputies
            var sumDeputies = 0;

            for (var i = 0; i < partiesInPeriod.length-1; i++) {
                // distance in spectrum betwen party i and i+1
                distances[i] = (partiesInPeriod[i].center[1]+1 - partiesInPeriod[i+1].center[1]+1)-2;

                sumDistances+=distances[i];
                sumDeputies+=partiesInPeriod[i].size;
            }
            sumDeputies+=partiesInPeriod[partiesInPeriod.length-1].size;
            // save half of the spectrum to show the parties
            var partiesPixels = (sumDeputies/513) * (pixelPercentageToParties * (height));
            var pixelPerDeputy = ( partiesPixels / sumDeputies ); // the amount of pixel that each deputy represent ( - 513 deputies in the brazilian camber)

            // remant pixels for the distances between parties
            var remnantPixels = height - partiesPixels;
            // calc the factor in wich should be multiplied the distances to get the sum of pixels == remnantPixels
            var distanceFactor = ( remnantPixels / sumDistances );
            // sum(distancesInPixels) == factor*sumDistances == sum(distances[i]*factor)
            var distancesInPixels = distances.map(function(dist){ return dist*distanceFactor });

            var pixelPosition = 0;
            // set the pixels positions
            for (var i = 0; i < partiesInPeriod.length; i++) {
                var party = partiesInPeriod[i];
                party.uncluttered = {};
                party.uncluttered.x0 = pixelPosition;
                party.uncluttered.height = (party.size * pixelPerDeputy);

                pixelPosition += distancesInPixels[i] +party.uncluttered.height;
            }
        }
    }
    function calcPartiesStepsCluttered(height,pixelPercentageToParties){
        // ------------------------------------------------------------
        // get parties for each period (biennial)
        periods = {};

        // for each year starting from first year
        for (var i = 1991; i < 2017; i++ ) {
            // for each period create an array of parties
            periods[i] = { parties:[] };
            for( party in CONGRESS_DEFINE.partiesTraces1by1.traces){
                // if the party did not exist(undefined) - do not push in the party array
                if(CONGRESS_DEFINE.partiesTraces1by1.traces[party][i] !== undefined){
                    CONGRESS_DEFINE.partiesTraces1by1.traces[party][i].party = party; //(garbage)
                    periods[i].parties.push( CONGRESS_DEFINE.partiesTraces1by1.traces[party][i] );
                }
            }
        }
        // for each period
        // - we need to know the size (in pixels) of the extreme parties of the spectrum
        //   to place them inside the height
        for( var period in periods){
            var partiesInPeriod = periods[period].parties;
            // sort parties by their 1D spectrum[1]
            partiesInPeriod.sort(function(a, b) {
                return (b.center[1]+1) - (a.center[1]+1);
            });

            // sum deputies
            var sumDeputies = 0;

            for (var i = 0; i < partiesInPeriod.length; i++) {
                //console.log(period, partiesInPeriod[i])
                sumDeputies+=partiesInPeriod[i].size;
            }
            // save half of the spectrum to show the parties
            var partiesPixels = (sumDeputies/513) * (pixelPercentageToParties * (height));
            var pixelPerDeputy = ( partiesPixels / sumDeputies ); // the amount of pixel that each deputy represent ( - 513 deputies in the brazilian camber)

            var scaleParties = d3.scale.linear()
                .domain([
                    // the the political spectrum domain of the period
                    CONGRESS_DEFINE.partiesTraces1by1.extents[period][1],
                    CONGRESS_DEFINE.partiesTraces1by1.extents[period][0]
                ])
                .range([
                    // the (width-height)/2 of first party in the spectrum
                    partiesInPeriod[0].size/2 * pixelPerDeputy,
                    // height + the (width-height)/2 of last party in the spectrum
                    height - ( partiesInPeriod[partiesInPeriod.length-1].size/2 * pixelPerDeputy )
                ]);

            // set the pixels positions
            for (var i = 0; i < partiesInPeriod.length; i++) {
                var party = partiesInPeriod[i];
                party.cluttered = {};

                party.cluttered.x0 = scaleParties(party.center[1]) - (party.size * pixelPerDeputy)/2;
                party.cluttered.height = (party.size * pixelPerDeputy);

                //.attr("y", function (d) { return scaleYearExtents[d.key](d.value.center[1]) - d.value.size/2} )

            }
        }
    }

    function forceAlgorithmToAproximateTheUnclutteredPositionsToClutteredWithoutOcclusion(timelineHeight) {
        d3.range(1991,2017,1).forEach(function(year) {
            var partiesInPeriod = [];
            for(var party in CONGRESS_DEFINE.partiesTraces1by1.traces){
                if(CONGRESS_DEFINE.partiesTraces1by1.traces[party][year])
                    partiesInPeriod.push(CONGRESS_DEFINE.partiesTraces1by1.traces[party][year]);
            }
            // d3.selectAll("rect.step.y"+year).data();
            partiesInPeriod.sort(function(a,b) {
                return a.uncluttered.x0 - b.uncluttered.x0;
            });
            var movement;
            do{ // repeat this loop til no parties' movment
                movement = false;
                partiesInPeriod.forEach( function(p,i){
                    var idealPoint = p.cluttered.x0,
                        x0 = p.uncluttered.x0,
                        x1 = x0 + p.uncluttered.height,
                        movUp = idealPoint > x0;

                    if(x0<1 || x1>timelineHeight || Math.abs(idealPoint-x0)<1) return;
                    var newX0 = Math.max(0,x0 + (movUp? 1 : -1)),
                        newX1 = Math.max(0,x1 + (movUp? 1 : -1)),
                        colision = false;

                    if(i!==(partiesInPeriod.length-1) && movUp && newX1 > partiesInPeriod[i+1].uncluttered.x0) colision = true;
                    if(i!==0 && !movUp && newX0 < (partiesInPeriod[i-1].uncluttered.x0+partiesInPeriod[i-1].uncluttered.height)) colision = true;

                    if(!colision) {
                        p.uncluttered.x0 = newX0;
                        movement = true;
                    }
                })
            } while(movement);
        });
    }

    function drawPartiesSteps(type){

        var firstYear = ranges.period[0].getFullYear();
        var lastYear = ranges.period[1].getFullYear();

        var steps = svg.selectAll('.parties .party')
            .selectAll('.steps')
            .data( function(d){return [d.value]});

        steps.enter().append('g').attr({'class':'steps'});

        var step = steps.selectAll('.step').data( function(d){ return d3.entries(d).filter(function(e){return e.key >= firstYear && e.key <= lastYear}) } );

        step.enter()
            .append('rect').attr('class','step')
            .attr( popoverAttr(partyPopOver,'top') );

        function partyPopOver( d ){
            console.log(d);
            console.log(CONGRESS_DEFINE.parties[d.value.party]);
            return '<h4>'+d.value.party+'</h4><em>'+((d.value.party)? CONGRESS_DEFINE.parties[d.value.party].name:'')+'</em>';
        }
        $('.timeline-crop .parties .party .steps .step').popover({ trigger: "hover" });

        step.transition(3000)
            .attr('class',function(d) {
                return 'step y'+d.key;
            })
            .attr("x", function (d) { return scaleX_middleOfBiennial(Number.parseInt(d.key)) -partyStepWidth/2} )
            .attr("y", function (d) { return d.value[type].x0 })
            .attr("height", function (d) { return d.value[type].height })
            .attr("width", partyStepWidth )
            .attr("opacity", 1 )
            .style("fill", function(d){ return CONGRESS_DEFINE.getPartyColor(d.value.party); } )
    }

    return chart;

}