var lunrIndex, pagesIndex;
var searchIndexLoaded = false;
var searchIndexLoading = false;

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Initialize lunrjs using our generated index file.
// Called lazily on first focus of the search field – not at page load.
function initLunr() {
    if (searchIndexLoading || searchIndexLoaded) return;
    searchIndexLoading = true;

    if (!endsWith(baseurl, "/")) {
        baseurl = baseurl + "/";
    }

    $.getJSON(baseurl + "index.json")
        .done(function (data) {
            pagesIndex = data;

            lunrIndex = lunr(function () {
                this.ref("uri");
                this.field("title", { boost: 10 });
                this.field("tags", { boost: 5 });
                this.field("content");

                var builder = this;
                data.forEach(function (page) {
                    builder.add({
                        uri: page.uri,
                        title: page.title,
                        tags: (page.tags || []).join(" "),
                        content: page.content || "",
                        description: page.description || ""
                    });
                });
            });

            searchIndexLoaded = true;
            searchIndexLoading = false;
        })
        .fail(function (jqxhr, textStatus, error) {
            var err = textStatus + ", " + error;
            console.error("Error getting index.json: ", err);
            searchIndexLoading = false;
        });
}

/**
 * Trigger a search in lunr and transform the result
 *
 * @param  {String} query
 * @return {Array}  results
 */
function search(query) {
    if (!lunrIndex) {
        return [];
    }

    var results = [];
    try {
        // Add wildcard to support partial word matching
        var wildcardQuery = query.split(/\s+/).map(function (term) {
            return term + "*";
        }).join(" ");
        results = lunrIndex.search(wildcardQuery);
    } catch (e) {
        // Fall back to plain query if wildcard syntax fails
        try {
            results = lunrIndex.search(query);
        } catch (e2) {
            return [];
        }
    }

    return results.map(function (result) {
        return pagesIndex.filter(function (page) {
            return page.uri === result.ref;
        })[0];
    }).filter(function (r) { return r; });
}

$(document).ready(function () {
    var searchInput = $("#search-by");

    // Lazy-load: fetch index only when user first focuses the search field
    searchInput.one("focus", function () {
        initLunr();
    });

    var horseyList = horsey(searchInput.get(0), {
        suggestions: function (value, done) {
            var query = searchInput.val();
            var results = search(query);
            done(results);
        },
        filter: function (q, suggestion) {
            return true;
        },
        set: function (value) {
            location.href = value.uri;
        },
        render: function (li, suggestion) {
            var query = searchInput.val();
            var numWords = 2;
            var text = suggestion.content.match(
                "(?:\\s?(?:[\\w]+)\\s?){0," + numWords + "}" + query + "(?:\\s?(?:[\\w]+)\\s?){0," + numWords + "}"
            );
            suggestion.context = text;
            var image =
                "<div>" +
                "\u00BB " +
                suggestion.title +
                '</div><div style="font-size:12px">' +
                (suggestion.context || "") +
                "</div>";
            li.innerHTML = image;
        },
        limit: 10,
    });
    horseyList.refreshPosition();
});
