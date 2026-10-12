package bench.spring;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/** A post as the API returns it (snake_case JSON). */
public record Post(
		long id,
		String body,
		@JsonProperty("created_at") String createdAt,
		String author,
		@JsonProperty("like_count") long likeCount) {

	/**
	 * Same text as the JS variants' {@code Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short",
	 * timeZone: "UTC"})} plus " UTC", e.g. "Dec 31, 2025, 11:59 PM UTC". An explicit pattern, because the JDK's
	 * localized MEDIUM/SHORT styles put a narrow no-break space (U+202F) before AM/PM.
	 */
	private static final DateTimeFormatter DISPLAY =
			DateTimeFormatter.ofPattern("MMM d, yyyy, h:mm a", Locale.ENGLISH).withZone(ZoneOffset.UTC);

	public String displayDate() {
		return DISPLAY.format(Instant.parse(createdAt)) + " UTC";
	}

	public record Feed(List<Post> posts) {}

	public record One(Post post) {}
}
