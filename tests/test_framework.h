/**
 * @file    test_framework.h
 * @brief   Minimal unit test helpers (no external dependency).
 */
#ifndef TEST_FRAMEWORK_H
#define TEST_FRAMEWORK_H

#include <stdio.h>
#include <string.h>

extern int g_testFailures;
extern int g_testChecks;

#define CHECK(cond)                                                              \
    do {                                                                         \
        g_testChecks++;                                                          \
        if (!(cond)) {                                                           \
            g_testFailures++;                                                    \
            printf("    FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);           \
        }                                                                        \
    } while (0)

#define CHECK_EQ(expected, actual)                                               \
    do {                                                                         \
        long long e_ = (long long)(expected);                                    \
        long long a_ = (long long)(actual);                                      \
        g_testChecks++;                                                          \
        if (e_ != a_) {                                                          \
            g_testFailures++;                                                    \
            printf("    FAIL %s:%d: %s == %s (expected %lld, got %lld)\n",       \
                   __FILE__, __LINE__, #expected, #actual, e_, a_);              \
        }                                                                        \
    } while (0)

#define CHECK_MEM(expected, actual, len)                                         \
    do {                                                                         \
        g_testChecks++;                                                          \
        if (memcmp((expected), (actual), (len)) != 0) {                          \
            g_testFailures++;                                                    \
            printf("    FAIL %s:%d: memory %s != %s\n",                          \
                   __FILE__, __LINE__, #expected, #actual);                      \
        }                                                                        \
    } while (0)

#define RUN_TEST(fn)                                                             \
    do {                                                                         \
        int before_ = g_testFailures;                                            \
        fn();                                                                    \
        printf("%s %s\n", (g_testFailures == before_) ? "[PASS]" : "[FAIL]", #fn); \
    } while (0)

#endif /* TEST_FRAMEWORK_H */
