// ==UserScript==
// @name        truemercenary
// @namespace   truemercenary
// @include     http://www.erepublik.com/*
// @grant       none
// @description Helps you to become a true mercenary
// @version     2
// ==/UserScript==

function main(){

var DataRegister = function(){
    this.attr = {};
    this.profile = $(".user_avatar").attr("href").split("/");
    this.profile = this.profile[this.profile.length-1];

    this.country = $(".user_country").attr("href").split("/");
    this.country = this.country[this.country.length-1];
    var self = this;
    this.sources = {
        country_not_conquered: {
            address: "/country-list-not-conquered"
        }
        ,battle_countries: {
            address: "/en/military/campaigns"
            ,filter : function(htmlsource){
                var result = {

                    accessible:{
                        selector: ".bod_listing, .allies_battles, .country_battles"
                        ,countries: {}
                    }
                    ,notaccessible:{

                        selector: ".all_battles"
                        ,countries: {}
                    }
                };
                var $htmlsource = $(htmlsource);
                var $accessible = $htmlsource.find(result.accessible.selector).find(">li strong");

                var $notaccessible = $htmlsource.find(result.notaccessible.selector + " > li strong");
                $accessible.each(function(){
                    var $this = $(this);
                    var $prev = $this.prevAll('img:not(.side_flags)');

                    var $flag = $this.prevAll('img.side_flags');
                    var temp = {
                        status: "other",
                        html: ""
                    };

                    if ($prev.hasClass("mpp_sign") || $this.text() === self.country) {
                        temp.status = "ally";
                    } else if ($prev.hasClass("resistance_sign")) {
                        temp.status = "resistance";
                    }

                    temp.html = '<a class="gold_amount" href="' +
                        $this.closest("li").find(".fight_button").attr("href") + '">' +

                        '<img src="/images/flags_png/S/' + $flag.attr("src").split("/").pop() + '">' +
                        '<strong>' + $this.html() + '</strong>' +

                        '</a>';
                    result.accessible.countries[$this.text()] = temp;
                });
                $notaccessible.each(function(){
                    result.notaccessible.countries[$(this).text()] = true;
                });
                return result;
            }
        }
        ,mercenary_countries: {
            address: "/en/citizen/profile/" + this.profile
            ,filter : function(htmlsource){
                var $htmlsource = $(htmlsource);
                var result = {
                    countries: {},
                    total: $htmlsource.find("li big strong").text()
                };

                $htmlsource.find(".country_list > li:not(.completed)").each(function(){
                    var $this = $(this);
                    result.countries[$this.attr("title")] = $this.find("em").text();
                });
                return result;
            }
        }
    };

    this.get = function(attr, nocache){
        // invalidate old values in localStorage
        if (nocache === false){
            var ls = window.localStorage["erepscript." + attr];
            if (ls === undefined) {
                ls = {timestamp: 0};
            } else {
                ls = JSON.parse(ls);
            }

            if (new Date() - ls.timestamp > 60000){
                delete window.localStorage["erepscript." + attr];
                ls = {value: null};
            }

            if (this.attr[attr]) return this.attr[attr];
            if (ls.value !== null) return $.Deferred().resolve(ls.value);
        }

        var self = this;
        return this.attr[attr] = $.get(this.sources[attr].address).then(function(value){
            var result;

            if (self.sources[attr].filter !== undefined){
                result = self.sources[attr].filter(value);
            } else {
                result = value;
            }
            window.localStorage["erepscript." + attr] = JSON.stringify({
                timestamp: +new Date()
                ,value: result
            });
            return result;
        });
    };

    this.require = function(sources, done, nocache){
        if (nocache === undefined){
            nocache = false;
        }
        var deferreds = [];
        for (var i=0; i<sources.length; i++){
            deferreds.push(this.get(sources[i], nocache));
        }
        return $.when.apply(this, deferreds).done(done);

    };
};
var register = new DataRegister();

var ErepScriptController = function(){
    this.mercenarySide = function(nocache){
        register.require(["battle_countries", "mercenary_countries"], function(battle_countries, mercenary_countries){

            var $sidebar = $('<div id="erepscript_mercenary" class="user_finances"></div>');
            $('<p>Mercenary (' + mercenary_countries.total + ') <a id="erepscript_mercenaryside_refresh">R</a></p>').css({

            'font-size': '11px',
            'text-align': 'center'
            }).appendTo($sidebar);

            for (var country in battle_countries.accessible.countries){
                if (mercenary_countries.countries[country] !== undefined && battle_countries.accessible.countries[country].status !== "other") {
                    var $temp = $(battle_countries.accessible.countries[country].html);

                    $temp.find("strong").text(mercenary_countries.countries[country]);
                    $temp.appendTo($sidebar);
                }
            }
            $("#erepscript_mercenary").remove();
            $(".user_finances").eq(0).after($sidebar);
        }, nocache);
    };
    this.mercenaryBattles = function(nocache){
        register.require(["battle_countries", "mercenary_countries"], function(battle_countries, mercenary_countries){
            for (var country in battle_countries.accessible.countries){
            if (mercenary_countries.countries[country] !== undefined) {
                var color = "blue";
                if (battle_countries.accessible.countries[country].status === "other"){
                    color = "grey";
                }
                $(battle_countries.accessible.selector).find(">li strong:contains(" + country + ")")
                .css("color", color).text(country + " " + mercenary_countries.countries[country]);

            }
            }
            for (country in battle_countries.notaccessible.countries){
                if (mercenary_countries.countries[country] !== undefined){
                    var thecolor = "orange";

                    if (mercenary_countries.countries[country] !== "0/25"){
                        thecolor = "red";
                    }
                    $(battle_countries.notaccessible.selector + "> li strong:contains(" + country + ")")
                    .css("color", thecolor).text(country + " " + mercenary_countries.countries[country]);
                }
            }
        }, nocache);
    };
    this.mercenaryNeighbors = function(nocache){
        if (window.localStorage["countries_distance_1"]) {
            var countries = JSON.parse(window.localStorage["countries_distance_1"]);
            console.log(countries);
        } else {
            register.require(["country_not_conquered"], function(country_not_conquered){
            country_not_conquered = JSON.parse(country_not_conquered);
            var deferred = $.Deferred().resolve();

            var countries_distance_1 = [];
            var getjson = function(i){
                return function(){
                    return $.getJSON("/region-list-current-owner/" + country_not_conquered[i].id).done(function(data){
                        for (var j=0;j<data.regions.length;j++){
                            if (data.regions[j].distance == 1){
                                countries_distance_1.push(country_not_conquered[i]);
                                break;
                            }

                        }
                    });
                }
            };

            for (var i=0;i<country_not_conquered.length;i++){
                deferred = deferred.then(getjson(i));
            }
            $.when(deferred).then(function(){
                window.localStorage["countries_distance_1"] = JSON.stringify(countries_distance_1);
            });
        }, nocache);
        }
    };
};
var controller = new ErepScriptController();

// mercenary side is always here

controller.mercenarySide();

// mercenary battles
if ($("#isBattleList")){
    controller.mercenaryBattles();
}

$("#large_sidebar").on("click", "#erepscript_mercenaryside_refresh", function(e){
    controller.mercenarySide(true);
    e.preventDefault();
});

if ($("select#country_list")) {
    controller.mercenaryNeighbors();
/*
    var deferreds = [];
    var xhr = $.getJSON("/country-list-not-conquered");

    $("#country_list option[value!=0]").each(function(){
        var $this = $(this);
    deferred.push($.getJSON("/region-list-current-owner/" + $this.attr("value")).then(function(data){

            for (var i=0;i<data.regions.length;i++){
                if (data.regions[i].distance == 1){
                    console.log($this.text());
                }
            }
        }));
    });

    $.when.apply(this, deferreds).done(function(){
       console.log(arguments);
    });
*/
};

}



(function(callback){
  var script = document.createElement("script");
  script.setAttribute("src", "http://code.jquery.com/jquery-1.9.1.min.js");

  script.addEventListener('load', function() {
    var script = document.createElement("script");
    script.textContent = "(" + callback.toString() + ")();";
    window.$ = jQuery.noConflict(true);

    document.body.appendChild(script);
  }, false);
  document.body.appendChild(script);
})(main);
